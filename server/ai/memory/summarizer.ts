/**
 * 蓉才通™ ATOS — Memory Summarizer
 * 
 * 记忆压缩与摘要系统：
 * - 会话摘要（对话 → 关键事实）
 * - 记忆合并（相似记忆 → 统一条目）
 * - 遗忘曲线（时间衰减 + 重要性保护）
 * - 分层摘要（细节 → 概要 → 元认知）
 * 
 * 对标：MemGPT / LangChain ConversationSummaryMemory
 */

import { memoryStore } from './store';
import { llm } from '../shared/llm/client';
import type {
  MemoryEntry,
  MemoryType,
  CompressionResult,
  SessionContext,
  ConversationTurn,
} from './types';

// ─── Configuration ───────────────────────────────────────────────────────────

interface SummarizerConfig {
  maxTurnsBeforeSummary: number;      // trigger summary after N turns
  summaryMaxTokens: number;
  compressionRatio: number;            // target: retain 1/N of original
  preserveCritical: boolean;           // never compress critical memories
  hierarchicalLevels: number;          // levels of summary hierarchy
}

const DEFAULT_CONFIG: SummarizerConfig = {
  maxTurnsBeforeSummary: 20,
  summaryMaxTokens: 500,
  compressionRatio: 3,
  preserveCritical: true,
  hierarchicalLevels: 3,
};

// ─── Memory Summarizer ───────────────────────────────────────────────────────

export class MemorySummarizer {
  private config: SummarizerConfig;

  constructor(config: Partial<SummarizerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Summarize a conversation session into key facts and memories.
   * Called when a session ends or reaches turn threshold.
   */
  async summarizeSession(sessionId: string): Promise<{
    summary: string;
    keyFacts: string[];
    decisions: string[];
    actionItems: string[];
    emotionalTone: string;
  }> {
    const context = await memoryStore.getSessionContext(sessionId);
    if (!context || context.turns.length === 0) {
      return { summary: '', keyFacts: [], decisions: [], actionItems: [], emotionalTone: 'neutral' };
    }

    const conversation = context.turns
      .map(t => `[${t.role}] ${t.content}`)
      .join('\n');

    const response = await llm.complete({
      messages: [
        {
          role: 'system',
          content: `Summarize this conversation into structured components.
Extract:
1. A concise summary (2-3 sentences)
2. Key facts learned (specific, verifiable statements)
3. Decisions made (choices/commitments)
4. Action items (things to do)
5. Emotional tone (one word: positive/negative/neutral/mixed)

Return as JSON:
{
  "summary": "...",
  "keyFacts": ["fact1", "fact2", ...],
  "decisions": ["decision1", ...],
  "actionItems": ["action1", ...],
  "emotionalTone": "..."
}`,
        },
        { role: 'user', content: conversation },
      ],
      temperature: 0.1,
      max_tokens: this.config.summaryMaxTokens,
      response_format: { type: 'json_object' },
      metadata: { tenantId: context.tenantId, agentName: 'memory-summarizer' },
    });

    try {
      return JSON.parse(response.content);
    } catch {
      return { summary: '', keyFacts: [], decisions: [], actionItems: [], emotionalTone: 'neutral' };
    }
  }

  /**
   * Incremental summarization — summarize only new turns since last summary.
   * Maintains a running summary that grows with the conversation.
   */
  async incrementalSummarize(
    sessionId: string,
    previousSummary: string,
    newTurns: ConversationTurn[]
  ): Promise<string> {
    if (newTurns.length === 0) return previousSummary;

    const newContent = newTurns.map(t => `[${t.role}] ${t.content}`).join('\n');

    const response = await llm.complete({
      messages: [
        {
          role: 'system',
          content: `You maintain a running summary of a conversation.
Given the previous summary and new conversation turns, produce an updated summary.
Rules:
- Preserve all important information from the previous summary
- Integrate new information from the latest turns
- Keep the summary concise (max 200 words)
- Focus on facts, decisions, and preferences — not pleasantries`,
        },
        {
          role: 'user',
          content: `Previous summary:\n${previousSummary || '(No previous summary)'}\n\nNew turns:\n${newContent}\n\nUpdated summary:`,
        },
      ],
      temperature: 0.1,
      max_tokens: 300,
      metadata: { tenantId: 'system', agentName: 'memory-summarizer' },
    });

    return response.content;
  }

  /**
   * Hierarchical memory compression.
   * Level 1: Individual memories
   * Level 2: Topic-grouped summaries
   * Level 3: High-level profile summary
   */
  async hierarchicalCompress(
    subjectId: string,
    type: MemoryType,
    tenantId: string
  ): Promise<{
    level1: MemoryEntry[];    // retained individual memories
    level2: string[];          // topic summaries
    level3: string;            // overall summary
  }> {
    const memories = await memoryStore.getBySubject(subjectId, type);

    if (memories.length < 5) {
      return {
        level1: memories,
        level2: [],
        level3: memories.map(m => m.content).join('. '),
      };
    }

    // Level 1: Keep critical and high-importance memories
    const level1 = memories.filter(m => 
      m.importance === 'critical' || m.importance === 'high'
    );

    // Level 2: Group remaining by topic and summarize
    const remaining = memories.filter(m => 
      m.importance !== 'critical' && m.importance !== 'high'
    );
    const topics = await this.groupByTopic(remaining);
    const level2: string[] = [];

    for (const [topic, entries] of Object.entries(topics)) {
      const summary = await this.summarizeGroup(topic, entries);
      level2.push(summary);
    }

    // Level 3: Overall summary
    const allContent = [
      ...level1.map(m => m.content),
      ...level2,
    ];
    const level3 = await this.createOverallSummary(subjectId, allContent);

    return { level1, level2, level3 };
  }

  /**
   * Compress memories for a subject when they exceed threshold.
   * Implements the "forgetting curve" — less important, older memories decay.
   */
  async autoCompress(
    subjectId: string,
    type: MemoryType,
    maxMemories: number = 50
  ): Promise<CompressionResult> {
    const memories = await memoryStore.getBySubject(subjectId, type);

    if (memories.length <= maxMemories) {
      return {
        originalCount: memories.length,
        compressedCount: memories.length,
        summary: 'No compression needed',
        retainedIds: memories.map(m => m.id),
        mergedIds: [],
        discardedIds: [],
      };
    }

    // Score each memory
    const scored = memories.map(m => ({
      memory: m,
      score: this.calculateRetentionScore(m),
    }));

    // Sort by score (highest = most worth keeping)
    scored.sort((a, b) => b.score - a.score);

    // Keep top N
    const retained = scored.slice(0, maxMemories);
    const toCompress = scored.slice(maxMemories);

    // Summarize compressed memories before removing
    const compressedContent = toCompress.map(s => s.memory.content);
    const summary = await this.summarizeGroup('compressed-memories', 
      toCompress.map(s => s.memory)
    );

    // Create a summary memory
    await memoryStore.create({
      type,
      subjectId,
      tenantId: memories[0]?.tenantId || 'default',
      content: `[Compressed Summary] ${summary}`,
      importance: 'medium',
      lastAccessedAt: new Date().toISOString(),
      tags: ['compressed', 'summary'],
      source: {
        type: 'system',
        agentName: 'memory-summarizer',
        timestamp: new Date().toISOString(),
      },
      metadata: {
        compressedCount: toCompress.length,
        compressedIds: toCompress.map(s => s.memory.id),
      },
    });

    // Delete compressed memories
    for (const item of toCompress) {
      await memoryStore.delete(item.memory.id);
    }

    return {
      originalCount: memories.length,
      compressedCount: retained.length + 1, // +1 for summary
      summary,
      retainedIds: retained.map(s => s.memory.id),
      mergedIds: [],
      discardedIds: toCompress.map(s => s.memory.id),
    };
  }

  /**
   * Extract and persist memories from a completed interaction.
   * Called at the end of any Agent pipeline execution.
   */
  async extractAndPersist(
    sessionId: string,
    subjectId: string,
    tenantId: string,
    type: MemoryType
  ): Promise<MemoryEntry[]> {
    const sessionSummary = await this.summarizeSession(sessionId);
    const created: MemoryEntry[] = [];

    // Persist key facts as individual memories
    for (const fact of sessionSummary.keyFacts) {
      const entry = await memoryStore.create({
        type,
        subjectId,
        tenantId,
        content: fact,
        importance: 'medium',
        lastAccessedAt: new Date().toISOString(),
        tags: ['extracted', 'fact'],
        source: {
          type: 'agent',
          agentName: 'memory-summarizer',
          timestamp: new Date().toISOString(),
          rawInput: sessionId,
        },
        metadata: { sessionId, confidence: 0.8 },
      });
      created.push(entry);
    }

    // Persist decisions as high-importance memories
    for (const decision of sessionSummary.decisions) {
      const entry = await memoryStore.create({
        type,
        subjectId,
        tenantId,
        content: decision,
        importance: 'high',
        lastAccessedAt: new Date().toISOString(),
        tags: ['extracted', 'decision'],
        source: {
          type: 'agent',
          agentName: 'memory-summarizer',
          timestamp: new Date().toISOString(),
        },
        metadata: { sessionId, confidence: 0.9 },
      });
      created.push(entry);
    }

    return created;
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private calculateRetentionScore(memory: MemoryEntry): number {
    const importanceWeights: Record<string, number> = {
      critical: 10, high: 7, medium: 4, low: 2, trivial: 0.5,
    };

    const importanceScore = importanceWeights[memory.importance] || 3;
    const accessScore = Math.log2(memory.accessCount + 1);
    const recencyScore = this.calculateRecency(memory.lastAccessedAt);
    const decayFactor = (memory.metadata.decay as number) || 1.0;

    return (importanceScore * 2 + accessScore + recencyScore * 3) * decayFactor;
  }

  private calculateRecency(dateStr: string): number {
    const ageMs = Date.now() - new Date(dateStr).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    // Exponential decay with 30-day half-life
    return Math.exp(-0.023 * ageDays);
  }

  private async groupByTopic(memories: MemoryEntry[]): Promise<Record<string, MemoryEntry[]>> {
    if (memories.length === 0) return {};

    const memoryTexts = memories.map((m, i) => `[${i}] ${m.content}`).join('\n');

    const response = await llm.complete({
      messages: [
        {
          role: 'system',
          content: `Group these memory entries by topic. Return a JSON object where keys are topic names and values are arrays of memory indices.
Example: {"skills": [0, 3, 7], "experience": [1, 4], "preferences": [2, 5, 6]}
Use 3-5 topic groups. Every memory must be assigned to exactly one group.`,
        },
        { role: 'user', content: memoryTexts },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
      metadata: { tenantId: 'system', agentName: 'memory-summarizer' },
    });

    try {
      const parsed = JSON.parse(response.content);
      const groups: Record<string, MemoryEntry[]> = {};
      for (const [topic, indices] of Object.entries(parsed)) {
        if (Array.isArray(indices)) {
          groups[topic] = (indices as number[])
            .filter(i => i >= 0 && i < memories.length)
            .map(i => memories[i]);
        }
      }
      return groups;
    } catch {
      return { default: memories };
    }
  }

  private async summarizeGroup(topic: string, memories: MemoryEntry[]): Promise<string> {
    if (memories.length === 0) return '';
    if (memories.length === 1) return memories[0].content;

    const content = memories.map(m => `- ${m.content}`).join('\n');

    const response = await llm.complete({
      messages: [
        {
          role: 'system',
          content: `Summarize these related memories into a single concise paragraph.
Topic: ${topic}
Preserve all key information. Be specific and factual.`,
        },
        { role: 'user', content },
      ],
      temperature: 0.1,
      max_tokens: 200,
      metadata: { tenantId: 'system', agentName: 'memory-summarizer' },
    });

    return response.content;
  }

  private async createOverallSummary(subjectId: string, contents: string[]): Promise<string> {
    const response = await llm.complete({
      messages: [
        {
          role: 'system',
          content: `Create a comprehensive profile summary for subject "${subjectId}" based on all available information.
This should be a 3-4 sentence overview capturing the most important characteristics, patterns, and context.`,
        },
        { role: 'user', content: contents.join('\n---\n') },
      ],
      temperature: 0.2,
      max_tokens: 200,
      metadata: { tenantId: 'system', agentName: 'memory-summarizer' },
    });

    return response.content;
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

export const memorySummarizer = new MemorySummarizer();
