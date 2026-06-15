/**
 * 蓉才通™ ATOS — Memory OS
 * 
 * 统一记忆系统入口。
 * 
 * 使用方式（所有 Agent 统一接口）：
 * 
 * ```typescript
 * import { memory } from '../memory';
 * 
 * // 1. 在 Agent 执行前注入记忆上下文
 * const injection = await memory.buildContext(sessionId, userId, candidateId);
 * const memoryPrompt = memory.formatForPrompt(injection);
 * // → 将 memoryPrompt 追加到 Agent 的 system prompt
 * 
 * // 2. 在 Agent 执行后持久化新记忆
 * await memory.store.create({
 *   type: 'candidate',
 *   subjectId: candidateId,
 *   tenantId,
 *   content: 'Candidate demonstrated strong leadership in behavioral question',
 *   importance: 'high',
 *   tags: ['interview', 'leadership'],
 *   source: { type: 'agent', agentName: 'star-agent', timestamp: new Date().toISOString() },
 *   metadata: { sessionId, confidence: 0.85 },
 *   lastAccessedAt: new Date().toISOString(),
 * });
 * 
 * // 3. 会话结束时提取并持久化记忆
 * await memory.summarizer.extractAndPersist(sessionId, userId, tenantId, 'user');
 * 
 * // 4. 定期反思（cron job）
 * await memory.reflection.periodicReflection(tenantId);
 * 
 * // 5. 记忆压缩（当记忆过多时）
 * await memory.summarizer.autoCompress(subjectId, 'candidate', 50);
 * ```
 */

export { memoryStore, MemoryStore } from './store';
export { memoryRetriever, MemoryRetriever } from './retriever';
export { memorySummarizer, MemorySummarizer } from './summarizer';
export { reflectionAgent, ReflectionAgent } from './reflection-agent';
export * from './types';
export * from './schema';

import { memoryStore } from './store';
import { memoryRetriever } from './retriever';
import { memorySummarizer } from './summarizer';
import { reflectionAgent } from './reflection-agent';
import type { MemoryInjection } from './types';

// ─── Unified Memory Interface ────────────────────────────────────────────────

/**
 * Memory OS — 统一接口
 * 
 * 所有 Agent 通过此接口访问记忆系统。
 */
export const memory = {
  /** Memory Store — CRUD + Search */
  store: memoryStore,

  /** Memory Retriever — 智能检索 + 上下文构建 */
  retriever: memoryRetriever,

  /** Memory Summarizer — 压缩 + 摘要 */
  summarizer: memorySummarizer,

  /** Reflection Agent — 自省 + 元认知 */
  reflection: reflectionAgent,

  /**
   * 快捷方法：为 Agent 构建完整记忆上下文
   */
  async buildContext(
    sessionId: string,
    userId: string,
    candidateId?: string,
    recruiterId?: string
  ): Promise<MemoryInjection> {
    return memoryRetriever.buildContext(sessionId, userId, candidateId, recruiterId);
  },

  /**
   * 快捷方法：将 MemoryInjection 格式化为 Prompt 片段
   */
  formatForPrompt(injection: MemoryInjection): string {
    return memoryRetriever.formatForPrompt(injection);
  },

  /**
   * 快捷方法：初始化 Memory OS（连接 Redis）
   */
  async initialize(): Promise<void> {
    await memoryStore.initialize();
  },

  /**
   * Agent Memory Injection Protocol
   * 
   * 标准化的记忆注入流程，所有 Agent 在执行前调用：
   * 
   * 1. 检索相关记忆
   * 2. 格式化为 prompt section
   * 3. 返回增强后的 system prompt
   */
  async injectMemory(
    baseSystemPrompt: string,
    sessionId: string,
    userId: string,
    options?: {
      candidateId?: string;
      recruiterId?: string;
      additionalContext?: string;
    }
  ): Promise<string> {
    try {
      const injection = await memoryRetriever.buildContext(
        sessionId,
        userId,
        options?.candidateId,
        options?.recruiterId
      );

      const memorySection = memoryRetriever.formatForPrompt(injection);

      if (!memorySection) return baseSystemPrompt;

      // Insert memory context between system prompt and instructions
      return `${baseSystemPrompt}\n\n${memorySection}${
        options?.additionalContext ? `\n\n<additional_context>\n${options.additionalContext}\n</additional_context>` : ''
      }`;
    } catch (error) {
      // Memory injection should never block Agent execution
      console.warn('[Memory] Injection failed, proceeding without memory:', error);
      return baseSystemPrompt;
    }
  },

  /**
   * Post-execution memory persistence.
   * Call after any Agent completes to store learnings.
   */
  async persistLearnings(
    sessionId: string,
    subjectId: string,
    tenantId: string,
    learnings: {
      facts?: string[];
      decisions?: string[];
      observations?: string[];
      agentName: string;
    }
  ): Promise<void> {
    const now = new Date().toISOString();
    const source = {
      type: 'agent' as const,
      agentName: learnings.agentName,
      timestamp: now,
    };

    // Persist facts
    if (learnings.facts) {
      for (const fact of learnings.facts) {
        await memoryStore.create({
          type: 'semantic',
          subjectId,
          tenantId,
          content: fact,
          importance: 'medium',
          lastAccessedAt: now,
          tags: ['fact', learnings.agentName],
          source,
          metadata: { sessionId, confidence: 0.8 },
        });
      }
    }

    // Persist decisions (higher importance)
    if (learnings.decisions) {
      for (const decision of learnings.decisions) {
        await memoryStore.create({
          type: 'episodic',
          subjectId,
          tenantId,
          content: decision,
          importance: 'high',
          lastAccessedAt: now,
          tags: ['decision', learnings.agentName],
          source,
          metadata: { sessionId, confidence: 0.9 },
        });
      }
    }

    // Persist observations
    if (learnings.observations) {
      for (const obs of learnings.observations) {
        await memoryStore.create({
          type: 'episodic',
          subjectId,
          tenantId,
          content: obs,
          importance: 'low',
          lastAccessedAt: now,
          tags: ['observation', learnings.agentName],
          source,
          metadata: { sessionId, confidence: 0.7 },
        });
      }
    }
  },
};

// ─── Redis Key Design Documentation ─────────────────────────────────────────

/**
 * Memory OS Redis Key Namespace:
 * 
 * Session Memory (TTL: 2h):
 *   hm:memory:session:{sessionId}:context     → SessionContext JSON
 *   hm:memory:session:{sessionId}:{key}       → Arbitrary session data
 * 
 * Hot Cache (TTL: 5min):
 *   hm:memory:cache:{memoryId}                → MemoryEntry JSON (hot read cache)
 * 
 * Persistence Fallback (TTL: 30d):
 *   hm:memory:store:{memoryId}                → MemoryEntry JSON (when Postgres unavailable)
 * 
 * Embedding Cache (TTL: 1h):
 *   hm:memory:embed:{contentHash}             → number[] (avoid re-embedding same content)
 * 
 * Reflection Lock (TTL: 10min):
 *   hm:memory:reflect:lock:{subjectId}        → "1" (prevent concurrent reflections)
 * 
 * Statistics (TTL: 1h):
 *   hm:memory:stats:{tenantId}                → MemoryStats JSON
 */
