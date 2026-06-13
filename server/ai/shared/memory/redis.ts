/**
 * 蓉才通™ ATOS — Redis Memory Layer
 * 
 * 用途：
 * - Interview Session Store（面试会话状态）
 * - Agent Memory（短期记忆）
 * - Rate Limiting
 * - Job Queue State
 * - Caching（LLM结果缓存）
 * 
 * Key Namespace设计：
 * - hm:session:{sessionId}          → Interview session state (Hash)
 * - hm:transcript:{sessionId}       → Live transcript (List)
 * - hm:scores:{sessionId}           → Real-time scores (Hash)
 * - hm:agent:memory:{agentId}:{ctx} → Agent short-term memory (String, TTL)
 * - hm:queue:{queueName}            → BullMQ job queue
 * - hm:cache:llm:{hash}             → LLM response cache (String, TTL)
 * - hm:ratelimit:{tenantId}:{api}   → Rate limit counter (String, TTL)
 */

import { createClient, type RedisClientType } from 'redis';

export interface RedisConfig {
  url: string;
  maxRetries: number;
  retryDelayMs: number;
}

const DEFAULT_CONFIG: RedisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  maxRetries: 5,
  retryDelayMs: 1000,
};

class RedisMemory {
  private client: RedisClientType | null = null;
  private config: RedisConfig;

  constructor(config: Partial<RedisConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async connect(): Promise<void> {
    if (this.client) return;
    this.client = createClient({
      url: this.config.url,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > this.config.maxRetries) return new Error('Max retries reached');
          return this.config.retryDelayMs * Math.pow(2, retries);
        },
      },
    }) as RedisClientType;

    this.client.on('error', (err) => console.error('[Redis] Error:', err));
    this.client.on('reconnecting', () => console.log('[Redis] Reconnecting...'));
    await this.client.connect();
  }

  private getClient(): RedisClientType {
    if (!this.client) throw new Error('Redis not connected. Call connect() first.');
    return this.client;
  }

  // ─── Interview Session ─────────────────────────────────────────────────────

  async createSession(sessionId: string, data: InterviewSessionData): Promise<void> {
    const client = this.getClient();
    const key = `hm:session:${sessionId}`;
    await client.hSet(key, this.flattenObject(data));
    await client.expire(key, 7200); // 2h TTL
  }

  async getSession(sessionId: string): Promise<InterviewSessionData | null> {
    const client = this.getClient();
    const data = await client.hGetAll(`hm:session:${sessionId}`);
    if (!data || Object.keys(data).length === 0) return null;
    return this.unflattenSession(data);
  }

  async updateSession(sessionId: string, updates: Partial<InterviewSessionData>): Promise<void> {
    const client = this.getClient();
    await client.hSet(`hm:session:${sessionId}`, this.flattenObject(updates));
  }

  async deleteSession(sessionId: string): Promise<void> {
    const client = this.getClient();
    await client.del([
      `hm:session:${sessionId}`,
      `hm:transcript:${sessionId}`,
      `hm:scores:${sessionId}`,
    ]);
  }

  // ─── Transcript ────────────────────────────────────────────────────────────

  async appendTranscript(sessionId: string, entry: TranscriptEntry): Promise<void> {
    const client = this.getClient();
    await client.rPush(`hm:transcript:${sessionId}`, JSON.stringify(entry));
    await client.expire(`hm:transcript:${sessionId}`, 7200);
  }

  async getTranscript(sessionId: string): Promise<TranscriptEntry[]> {
    const client = this.getClient();
    const entries = await client.lRange(`hm:transcript:${sessionId}`, 0, -1);
    return entries.map(e => JSON.parse(e));
  }

  async getRecentTranscript(sessionId: string, count: number): Promise<TranscriptEntry[]> {
    const client = this.getClient();
    const entries = await client.lRange(`hm:transcript:${sessionId}`, -count, -1);
    return entries.map(e => JSON.parse(e));
  }

  // ─── Real-time Scores ──────────────────────────────────────────────────────

  async updateScores(sessionId: string, scores: Record<string, number>): Promise<void> {
    const client = this.getClient();
    const key = `hm:scores:${sessionId}`;
    const stringScores: Record<string, string> = {};
    for (const [k, v] of Object.entries(scores)) {
      stringScores[k] = String(v);
    }
    await client.hSet(key, stringScores);
    await client.expire(key, 7200);
  }

  async getScores(sessionId: string): Promise<Record<string, number>> {
    const client = this.getClient();
    const data = await client.hGetAll(`hm:scores:${sessionId}`);
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(data)) {
      result[k] = parseFloat(v);
    }
    return result;
  }

  // ─── Agent Memory ──────────────────────────────────────────────────────────

  async setAgentMemory(agentId: string, context: string, data: unknown, ttlSeconds = 3600): Promise<void> {
    const client = this.getClient();
    const key = `hm:agent:memory:${agentId}:${context}`;
    await client.set(key, JSON.stringify(data), { EX: ttlSeconds });
  }

  async getAgentMemory<T = unknown>(agentId: string, context: string): Promise<T | null> {
    const client = this.getClient();
    const data = await client.get(`hm:agent:memory:${agentId}:${context}`);
    return data ? JSON.parse(data) as T : null;
  }

  // ─── LLM Cache ─────────────────────────────────────────────────────────────

  async cacheLLMResponse(hash: string, response: unknown, ttlSeconds = 1800): Promise<void> {
    const client = this.getClient();
    await client.set(`hm:cache:llm:${hash}`, JSON.stringify(response), { EX: ttlSeconds });
  }

  async getCachedLLMResponse<T = unknown>(hash: string): Promise<T | null> {
    const client = this.getClient();
    const data = await client.get(`hm:cache:llm:${hash}`);
    return data ? JSON.parse(data) as T : null;
  }

  // ─── Rate Limiting ─────────────────────────────────────────────────────────

  async checkRateLimit(tenantId: string, api: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
    const client = this.getClient();
    const key = `hm:ratelimit:${tenantId}:${api}`;
    const current = await client.incr(key);
    if (current === 1) {
      await client.expire(key, windowSeconds);
    }
    return current <= maxRequests;
  }

  // ─── Pub/Sub for Real-time Events ──────────────────────────────────────────

  async publish(channel: string, message: unknown): Promise<void> {
    const client = this.getClient();
    await client.publish(channel, JSON.stringify(message));
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  private flattenObject(obj: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null) continue;
      result[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
    }
    return result;
  }

  private unflattenSession(data: Record<string, string>): InterviewSessionData {
    return {
      sessionId: data.sessionId || '',
      tenantId: data.tenantId || '',
      candidateId: data.candidateId || '',
      positionId: data.positionId || '',
      interviewerId: data.interviewerId || '',
      status: (data.status as InterviewSessionData['status']) || 'waiting',
      startedAt: data.startedAt || '',
      currentQuestionIdx: parseInt(data.currentQuestionIdx || '0'),
      totalQuestions: parseInt(data.totalQuestions || '0'),
      elapsedSeconds: parseInt(data.elapsedSeconds || '0'),
      questions: data.questions ? JSON.parse(data.questions) : [],
    };
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InterviewSessionData {
  sessionId: string;
  tenantId: string;
  candidateId: string;
  positionId: string;
  interviewerId: string;
  status: 'waiting' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
  startedAt: string;
  currentQuestionIdx: number;
  totalQuestions: number;
  elapsedSeconds: number;
  questions: InterviewQuestion[];
}

export interface InterviewQuestion {
  id: string;
  text: string;
  type: 'behavioral' | 'technical' | 'situational' | 'followup';
  competency: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number; // seconds
  askedAt?: string;
  answeredAt?: string;
}

export interface TranscriptEntry {
  id: string;
  timestamp: string;
  speaker: 'candidate' | 'interviewer' | 'system';
  text: string;
  confidence?: number; // ASR confidence
  duration_ms?: number;
  language?: string;
}

// Singleton
export const redis = new RedisMemory();

export function createRedisMemory(config: Partial<RedisConfig>): RedisMemory {
  return new RedisMemory(config);
}
