/**
 * 蓉才通™ ATOS — Memory Retriever
 * 
 * 智能记忆检索层：
 * - Hybrid Search（语义 + 关键词 + 时间衰减 + 重要性加权）
 * - Reranker（LLM-based relevance reranking）
 * - Context Builder（为 Agent 构建注入上下文）
 * - Memory Injection Protocol（统一接口供所有 Agent 使用）
 * 
 * 对标：Mem0 Retrieval / LangChain Memory Retriever / RAG Pipeline
 */

import { memoryStore } from './store';
import { llm } from '../shared/llm/client';
import type {
  MemoryQuery,
  MemorySearchResult,
  MemoryInjection,
  MemoryType,
  MemoryEntry,
  IMemoryRetriever,
} from './types';

// ─── Configuration ───────────────────────────────────────────────────────────

interface RetrieverConfig {
  maxSessionMemories: number;
  maxLongTermMemories: number;
  maxEpisodicMemories: number;
  semanticWeight: number;
  recencyWeight: number;
  importanceWeight: number;
  accessWeight: number;
  rerankerEnabled: boolean;
  rerankerTopK: number;
  decayLambda: number;  // exponential decay rate
}

const DEFAULT_CONFIG: RetrieverConfig = {
  maxSessionMemories: 10,
  maxLongTermMemories: 15,
  maxEpisodicMemories: 5,
  semanticWeight: 0.4,
  recencyWeight: 0.25,
  importanceWeight: 0.2,
  accessWeight: 0.15,
  rerankerEnabled: true,
  rerankerTopK: 5,
  decayLambda: 0.023, // ~30 day half-life
};

// ─── Memory Retriever Implementation ─────────────────────────────────────────

export class MemoryRetriever implements IMemoryRetriever {
  private config: RetrieverConfig;

  constructor(config: Partial<RetrieverConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Primary retrieval method — returns a complete MemoryInjection
   * ready to be inserted into any Agent's system prompt.
   */
  async retrieve(query: MemoryQuery): Promise<MemoryInjection> {
    const [sessionMem, longTermMem, episodicMem] = await Promise.all([
      this.retrieveSessionMemories(query),
      this.retrieveLongTermMemories(query),
      this.retrieveEpisodicMemories(query),
    ]);

    // Separate by category
    const userPrefs = longTermMem
      .filter(r => r.entry.type === 'user')
      .map(r => r.entry.content);

    const candidateCtx = longTermMem
      .filter(r => r.entry.type === 'candidate')
      .map(r => r.entry.content);

    const recruiterCtx = longTermMem
      .filter(r => r.entry.type === 'recruiter')
      .map(r => r.entry.content);

    const relevantMemories = longTermMem
      .filter(r => r.entry.type === 'semantic')
      .map(r => r.entry.content);

    return {
      sessionMemory: sessionMem.map(r => r.entry.content),
      relevantMemories,
      userPreferences: userPrefs,
      candidateContext: candidateCtx,
      recruiterContext: recruiterCtx,
      episodicContext: episodicMem.map(r => r.entry.content),
    };
  }

  /**
   * Build full context for a specific session/user/candidate/recruiter combination.
   * This is the main entry point for Agent memory injection.
   */
  async buildContext(
    sessionId: string,
    userId: string,
    candidateId?: string,
    recruiterId?: string
  ): Promise<MemoryInjection> {
    const tenantId = await this.getTenantFromSession(sessionId);

    // Parallel retrieval of all memory types
    const [sessionCtx, userMem, candidateMem, recruiterMem, semanticMem, episodicMem] = await Promise.all([
      this.getSessionFacts(sessionId),
      this.getUserMemories(userId, tenantId),
      candidateId ? this.getCandidateMemories(candidateId, tenantId) : Promise.resolve([]),
      recruiterId ? this.getRecruiterMemories(recruiterId, tenantId) : Promise.resolve([]),
      this.getRelevantSemanticMemories(sessionId, tenantId),
      this.getRelevantEpisodes(userId, tenantId),
    ]);

    return {
      sessionMemory: sessionCtx,
      relevantMemories: semanticMem.map(m => m.content),
      userPreferences: userMem.map(m => m.content),
      candidateContext: candidateMem.map(m => m.content),
      recruiterContext: recruiterMem.map(m => m.content),
      episodicContext: episodicMem.map(m => m.content),
    };
  }

  /**
   * Format MemoryInjection into a system prompt section.
   * This is what gets prepended to Agent prompts.
   */
  formatForPrompt(injection: MemoryInjection): string {
    const sections: string[] = [];

    if (injection.sessionMemory.length > 0) {
      sections.push(`## Current Session Context\n${injection.sessionMemory.map(m => `- ${m}`).join('\n')}`);
    }

    if (injection.userPreferences.length > 0) {
      sections.push(`## User Preferences & History\n${injection.userPreferences.map(m => `- ${m}`).join('\n')}`);
    }

    if (injection.candidateContext.length > 0) {
      sections.push(`## Candidate Profile Memory\n${injection.candidateContext.map(m => `- ${m}`).join('\n')}`);
    }

    if (injection.recruiterContext.length > 0) {
      sections.push(`## Recruiter Preferences\n${injection.recruiterContext.map(m => `- ${m}`).join('\n')}`);
    }

    if (injection.relevantMemories.length > 0) {
      sections.push(`## Relevant Knowledge\n${injection.relevantMemories.map(m => `- ${m}`).join('\n')}`);
    }

    if (injection.episodicContext.length > 0) {
      sections.push(`## Past Interactions\n${injection.episodicContext.map(m => `- ${m}`).join('\n')}`);
    }

    if (sections.length === 0) return '';

    return `<memory_context>\n${sections.join('\n\n')}\n</memory_context>`;
  }

  // ─── Private: Retrieval by Type ──────────────────────────────────────────

  private async retrieveSessionMemories(query: MemoryQuery): Promise<MemorySearchResult[]> {
    const results = await memoryStore.search({
      ...query,
      types: ['session'],
      limit: this.config.maxSessionMemories,
    });
    return results;
  }

  private async retrieveLongTermMemories(query: MemoryQuery): Promise<MemorySearchResult[]> {
    const results = await memoryStore.search({
      ...query,
      types: ['user', 'candidate', 'recruiter', 'semantic'],
      limit: this.config.maxLongTermMemories,
    });

    // Apply reranker if enabled
    if (this.config.rerankerEnabled && results.length > this.config.rerankerTopK) {
      return this.rerank(query.query, results, this.config.rerankerTopK);
    }

    return results;
  }

  private async retrieveEpisodicMemories(query: MemoryQuery): Promise<MemorySearchResult[]> {
    const results = await memoryStore.search({
      ...query,
      types: ['episodic'],
      limit: this.config.maxEpisodicMemories,
    });
    return results;
  }

  // ─── Private: Context Helpers ────────────────────────────────────────────

  private async getSessionFacts(sessionId: string): Promise<string[]> {
    const context = await memoryStore.getSessionContext(sessionId);
    if (!context) return [];
    return context.shortTermFacts || [];
  }

  private async getUserMemories(userId: string, tenantId: string): Promise<MemoryEntry[]> {
    return memoryStore.getBySubject(userId, 'user');
  }

  private async getCandidateMemories(candidateId: string, tenantId: string): Promise<MemoryEntry[]> {
    return memoryStore.getBySubject(candidateId, 'candidate');
  }

  private async getRecruiterMemories(recruiterId: string, tenantId: string): Promise<MemoryEntry[]> {
    return memoryStore.getBySubject(recruiterId, 'recruiter');
  }

  private async getRelevantSemanticMemories(sessionId: string, tenantId: string): Promise<MemoryEntry[]> {
    // Get recent session context to build query
    const context = await memoryStore.getSessionContext(sessionId);
    if (!context || context.turns.length === 0) return [];

    // Use last few turns as query
    const recentContent = context.turns.slice(-3).map(t => t.content).join(' ');
    const results = await memoryStore.search({
      query: recentContent,
      types: ['semantic'],
      tenantId,
      limit: 5,
    });

    return results.map(r => r.entry);
  }

  private async getRelevantEpisodes(userId: string, tenantId: string): Promise<MemoryEntry[]> {
    const results = await memoryStore.search({
      query: '', // will use subject filter
      types: ['episodic'],
      subjectId: userId,
      tenantId,
      limit: this.config.maxEpisodicMemories,
    });
    return results.map(r => r.entry);
  }

  private async getTenantFromSession(sessionId: string): Promise<string> {
    const context = await memoryStore.getSessionContext(sessionId);
    return context?.tenantId || 'default';
  }

  // ─── Private: Reranker ───────────────────────────────────────────────────

  private async rerank(
    query: string,
    results: MemorySearchResult[],
    topK: number
  ): Promise<MemorySearchResult[]> {
    if (results.length <= topK) return results;

    try {
      // LLM-based reranking
      const candidates = results.map((r, i) => `[${i}] ${r.entry.content}`).join('\n');

      const response = await llm.complete({
        messages: [
          {
            role: 'system',
            content: `You are a relevance judge. Given a query and a list of memory entries, rank them by relevance.
Return a JSON array of indices in order of relevance (most relevant first).
Return ONLY the JSON array of numbers, nothing else.
Example: [3, 1, 7, 0, 5]`,
          },
          {
            role: 'user',
            content: `Query: "${query}"\n\nMemory entries:\n${candidates}\n\nReturn top ${topK} indices by relevance:`,
          },
        ],
        temperature: 0,
        max_tokens: 100,
        response_format: { type: 'json_object' },
        metadata: { tenantId: 'system', agentName: 'memory-reranker' },
      });

      const parsed = JSON.parse(response.content);
      const indices: number[] = Array.isArray(parsed) ? parsed : (parsed.indices || parsed.ranking || []);
      
      return indices
        .slice(0, topK)
        .filter(i => i >= 0 && i < results.length)
        .map(i => results[i]);
    } catch {
      // Fallback: return top-K by combined score
      return results
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, topK);
    }
  }

  // ─── Scoring ─────────────────────────────────────────────────────────────

  /**
   * Calculate combined relevance score for a memory entry.
   * Used when pgvector is not available (degraded mode).
   */
  calculateScore(entry: MemoryEntry, queryEmbedding?: number[]): number {
    const now = Date.now();
    const createdAt = new Date(entry.createdAt).getTime();
    const ageHours = (now - createdAt) / (1000 * 60 * 60);

    // Semantic score (cosine similarity)
    let semanticScore = 0;
    if (queryEmbedding && entry.embedding) {
      semanticScore = this.cosineSimilarity(queryEmbedding, entry.embedding);
    }

    // Recency score (exponential decay)
    const recencyScore = Math.exp(-this.config.decayLambda * (ageHours / 24));

    // Importance score
    const importanceMap: Record<string, number> = {
      critical: 1.0, high: 0.8, medium: 0.6, low: 0.3, trivial: 0.1,
    };
    const importanceScore = importanceMap[entry.importance] || 0.5;

    // Access frequency score (log scale)
    const accessScore = Math.min(Math.log2(entry.accessCount + 1) / 10, 1.0);

    // Weighted combination
    return (
      this.config.semanticWeight * semanticScore +
      this.config.recencyWeight * recencyScore +
      this.config.importanceWeight * importanceScore +
      this.config.accessWeight * accessScore
    );
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

export const memoryRetriever = new MemoryRetriever();
