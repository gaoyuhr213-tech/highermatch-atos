/**
 * 蓉才通™ ATOS — Reflection Agent
 * 
 * 记忆自省系统：
 * - 定期审视已有记忆，发现模式与矛盾
 * - 从多次交互中提取高阶洞察
 * - 生成新的元记忆（关于记忆的记忆）
 * - 触发记忆压缩与整合
 * 
 * 对标：Generative Agents (Stanford) / Reflexion / Self-Refine
 */

import { memoryStore } from './store';
import { llm } from '../shared/llm/client';
import type {
  MemoryEntry,
  MemoryType,
  ReflectionResult,
  MemorySource,
} from './types';

// ─── Configuration ───────────────────────────────────────────────────────────

interface ReflectionConfig {
  minMemoriesForReflection: number;
  maxMemoriesPerReflection: number;
  reflectionDepth: 'shallow' | 'deep';
  autoCreateMemories: boolean;
  contradictionThreshold: number;  // cosine similarity for contradiction detection
}

const DEFAULT_CONFIG: ReflectionConfig = {
  minMemoriesForReflection: 5,
  maxMemoriesPerReflection: 20,
  reflectionDepth: 'deep',
  autoCreateMemories: true,
  contradictionThreshold: 0.7,
};

// ─── Reflection Agent ────────────────────────────────────────────────────────

export class ReflectionAgent {
  private config: ReflectionConfig;

  constructor(config: Partial<ReflectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Perform reflection on a subject's memories.
   * Generates insights, detects patterns, finds contradictions.
   */
  async reflect(
    subjectId: string,
    type: MemoryType,
    tenantId: string
  ): Promise<ReflectionResult> {
    const memories = await memoryStore.getBySubject(subjectId, type);

    if (memories.length < this.config.minMemoriesForReflection) {
      return {
        insights: [],
        patterns: [],
        contradictions: [],
        recommendations: [],
        newMemories: [],
      };
    }

    // Take most recent/important memories for reflection
    const selected = this.selectForReflection(memories);

    // Run reflection pipeline
    const [insights, patterns, contradictions] = await Promise.all([
      this.extractInsights(selected, subjectId),
      this.detectPatterns(selected, subjectId),
      this.findContradictions(selected),
    ]);

    // Generate recommendations
    const recommendations = await this.generateRecommendations(
      insights, patterns, contradictions, subjectId
    );

    // Create new meta-memories if enabled
    const newMemories: Partial<MemoryEntry>[] = [];
    if (this.config.autoCreateMemories) {
      for (const insight of insights) {
        newMemories.push({
          type: 'semantic',
          subjectId,
          tenantId,
          content: `[Reflection Insight] ${insight}`,
          importance: 'high',
          tags: ['reflection', 'insight', type],
          source: {
            type: 'reflection',
            agentName: 'reflection-agent',
            timestamp: new Date().toISOString(),
          },
          metadata: {
            sourceMemoryCount: selected.length,
            reflectionDepth: this.config.reflectionDepth,
          },
        });
      }

      for (const pattern of patterns) {
        newMemories.push({
          type: 'semantic',
          subjectId,
          tenantId,
          content: `[Detected Pattern] ${pattern}`,
          importance: 'medium',
          tags: ['reflection', 'pattern', type],
          source: {
            type: 'reflection',
            agentName: 'reflection-agent',
            timestamp: new Date().toISOString(),
          },
          metadata: {
            sourceMemoryCount: selected.length,
          },
        });
      }

      // Persist new memories
      for (const mem of newMemories) {
        await memoryStore.create({
          type: mem.type || 'semantic',
          subjectId: mem.subjectId || subjectId,
          tenantId: mem.tenantId || tenantId,
          content: mem.content || '',
          importance: mem.importance || 'medium',
          lastAccessedAt: new Date().toISOString(),
          tags: mem.tags || [],
          source: mem.source || {
            type: 'reflection',
            agentName: 'reflection-agent',
            timestamp: new Date().toISOString(),
          },
          metadata: mem.metadata || {},
        });
      }
    }

    return {
      insights,
      patterns,
      contradictions,
      recommendations,
      newMemories,
    };
  }

  /**
   * Periodic reflection — runs on schedule for all active subjects.
   */
  async periodicReflection(tenantId: string): Promise<Map<string, ReflectionResult>> {
    const results = new Map<string, ReflectionResult>();

    // Get all subjects with enough memories
    const recentMemories = await memoryStore.getRecent(tenantId, 100);
    const subjects = new Set(recentMemories.map(m => m.subjectId));

    for (const subjectId of subjects) {
      const subjectMemories = recentMemories.filter(m => m.subjectId === subjectId);
      if (subjectMemories.length >= this.config.minMemoriesForReflection) {
        // Determine dominant type
        const typeCounts = new Map<MemoryType, number>();
        for (const m of subjectMemories) {
          typeCounts.set(m.type, (typeCounts.get(m.type) || 0) + 1);
        }
        const dominantType = [...typeCounts.entries()]
          .sort((a, b) => b[1] - a[1])[0][0];

        const result = await this.reflect(subjectId, dominantType, tenantId);
        if (result.insights.length > 0 || result.patterns.length > 0) {
          results.set(subjectId, result);
        }
      }
    }

    return results;
  }

  /**
   * Cross-subject reflection — find patterns across multiple subjects.
   * Useful for: "What do successful candidates have in common?"
   */
  async crossSubjectReflection(
    subjectIds: string[],
    type: MemoryType,
    tenantId: string,
    question: string
  ): Promise<ReflectionResult> {
    const allMemories: MemoryEntry[] = [];
    for (const id of subjectIds) {
      const memories = await memoryStore.getBySubject(id, type);
      allMemories.push(...memories.slice(0, 10)); // limit per subject
    }

    if (allMemories.length < this.config.minMemoriesForReflection) {
      return { insights: [], patterns: [], contradictions: [], recommendations: [], newMemories: [] };
    }

    const memoryTexts = allMemories.map(m => 
      `[${m.subjectId}] ${m.content}`
    ).join('\n');

    const response = await llm.complete({
      messages: [
        {
          role: 'system',
          content: `You are a reflection agent performing cross-subject analysis.
Analyze memories from multiple subjects to answer a specific question.
Return your analysis as JSON with these fields:
{
  "insights": ["insight1", "insight2", ...],
  "patterns": ["pattern1", "pattern2", ...],
  "contradictions": ["contradiction1", ...],
  "recommendations": ["recommendation1", ...]
}
Be specific and data-driven. Reference specific subjects when relevant.`,
        },
        {
          role: 'user',
          content: `Question: ${question}\n\nMemories from ${subjectIds.length} subjects:\n${memoryTexts}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
      metadata: { tenantId, agentName: 'reflection-agent' },
    });

    try {
      const parsed = JSON.parse(response.content);
      return {
        insights: parsed.insights || [],
        patterns: parsed.patterns || [],
        contradictions: parsed.contradictions || [],
        recommendations: parsed.recommendations || [],
        newMemories: [],
      };
    } catch {
      return { insights: [], patterns: [], contradictions: [], recommendations: [], newMemories: [] };
    }
  }

  // ─── Private Methods ─────────────────────────────────────────────────────

  private selectForReflection(memories: MemoryEntry[]): MemoryEntry[] {
    // Sort by importance + recency, take top N
    return memories
      .sort((a, b) => {
        const importanceMap: Record<string, number> = {
          critical: 5, high: 4, medium: 3, low: 2, trivial: 1,
        };
        const aScore = (importanceMap[a.importance] || 3) + 
          (new Date(a.createdAt).getTime() / 1e12);
        const bScore = (importanceMap[b.importance] || 3) + 
          (new Date(b.createdAt).getTime() / 1e12);
        return bScore - aScore;
      })
      .slice(0, this.config.maxMemoriesPerReflection);
  }

  private async extractInsights(memories: MemoryEntry[], subjectId: string): Promise<string[]> {
    const memoryTexts = memories.map(m => `- ${m.content}`).join('\n');

    const response = await llm.complete({
      messages: [
        {
          role: 'system',
          content: `You are a reflection agent. Analyze these memories about subject "${subjectId}" and extract high-level insights that are NOT explicitly stated in any single memory but emerge from the combination.

Rules:
- Each insight must be a new understanding derived from multiple memories
- Be specific and actionable
- Maximum 5 insights
- Return as JSON: {"insights": ["insight1", "insight2", ...]}`,
        },
        { role: 'user', content: `Memories:\n${memoryTexts}` },
      ],
      temperature: 0.4,
      max_tokens: 800,
      response_format: { type: 'json_object' },
      metadata: { tenantId: 'system', agentName: 'reflection-agent' },
    });

    try {
      const parsed = JSON.parse(response.content);
      return parsed.insights || [];
    } catch {
      return [];
    }
  }

  private async detectPatterns(memories: MemoryEntry[], subjectId: string): Promise<string[]> {
    const memoryTexts = memories.map(m => 
      `[${new Date(m.createdAt).toLocaleDateString()}] ${m.content}`
    ).join('\n');

    const response = await llm.complete({
      messages: [
        {
          role: 'system',
          content: `Analyze these time-ordered memories and detect behavioral patterns, recurring themes, or trends.

Rules:
- Focus on patterns that repeat at least twice
- Note any changes over time (improvements, regressions)
- Maximum 5 patterns
- Return as JSON: {"patterns": ["pattern1", "pattern2", ...]}`,
        },
        { role: 'user', content: `Subject: ${subjectId}\nMemories:\n${memoryTexts}` },
      ],
      temperature: 0.3,
      max_tokens: 600,
      response_format: { type: 'json_object' },
      metadata: { tenantId: 'system', agentName: 'reflection-agent' },
    });

    try {
      const parsed = JSON.parse(response.content);
      return parsed.patterns || [];
    } catch {
      return [];
    }
  }

  private async findContradictions(memories: MemoryEntry[]): Promise<string[]> {
    if (memories.length < 3) return [];

    const memoryTexts = memories.map((m, i) => `[${i}] ${m.content}`).join('\n');

    const response = await llm.complete({
      messages: [
        {
          role: 'system',
          content: `Analyze these memories and find any contradictions or inconsistencies.
A contradiction is when two memories make claims that cannot both be true.

Rules:
- Only report clear contradictions, not mere differences
- Reference the memory indices
- Maximum 3 contradictions
- Return as JSON: {"contradictions": ["Memory [X] says ... but Memory [Y] says ...", ...]}
- If no contradictions found, return {"contradictions": []}`,
        },
        { role: 'user', content: `Memories:\n${memoryTexts}` },
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      metadata: { tenantId: 'system', agentName: 'reflection-agent' },
    });

    try {
      const parsed = JSON.parse(response.content);
      return parsed.contradictions || [];
    } catch {
      return [];
    }
  }

  private async generateRecommendations(
    insights: string[],
    patterns: string[],
    contradictions: string[],
    subjectId: string
  ): Promise<string[]> {
    if (insights.length === 0 && patterns.length === 0) return [];

    const context = [
      insights.length > 0 ? `Insights: ${insights.join('; ')}` : '',
      patterns.length > 0 ? `Patterns: ${patterns.join('; ')}` : '',
      contradictions.length > 0 ? `Contradictions: ${contradictions.join('; ')}` : '',
    ].filter(Boolean).join('\n');

    const response = await llm.complete({
      messages: [
        {
          role: 'system',
          content: `Based on the reflection analysis, generate actionable recommendations.
These should be specific actions the system or user can take.
Return as JSON: {"recommendations": ["recommendation1", ...]}
Maximum 3 recommendations.`,
        },
        { role: 'user', content: `Subject: ${subjectId}\n${context}` },
      ],
      temperature: 0.3,
      max_tokens: 400,
      response_format: { type: 'json_object' },
      metadata: { tenantId: 'system', agentName: 'reflection-agent' },
    });

    try {
      const parsed = JSON.parse(response.content);
      return parsed.recommendations || [];
    } catch {
      return [];
    }
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

export const reflectionAgent = new ReflectionAgent();
