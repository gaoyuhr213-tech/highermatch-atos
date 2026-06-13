/**
 * 蓉才通™ ATOS — Interview Agent Base Class
 * 
 * 所有面试Agent的抽象基类，提供：
 * - LLM调用
 * - Memory读写
 * - Event发布
 * - 结构化输出解析
 */

import { llm, type LLMMessage, type LLMCompletionResponse } from '../../shared/llm/client';
import { redis } from '../../shared/memory/redis';
import { eventBus, type EventType, type EventPayload } from '../../shared/events/bus';

export interface AgentContext {
  sessionId: string;
  tenantId: string;
  candidateId: string;
  positionId: string;
  transcript: string;
  currentQuestion?: string;
  competencies: string[];
}

export interface AgentResult<T = unknown> {
  success: boolean;
  data: T;
  confidence: number;
  reasoning?: string;
  latency_ms: number;
}

export abstract class InterviewAgent {
  abstract readonly name: string;
  abstract readonly description: string;

  protected async callLLM(
    messages: LLMMessage[],
    options?: { model?: string; temperature?: number; maxTokens?: number; jsonMode?: boolean }
  ): Promise<LLMCompletionResponse> {
    return llm.complete({
      model: options?.model,
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 2048,
      response_format: options?.jsonMode ? { type: 'json_object' } : undefined,
      metadata: { tenantId: 'system', agentName: this.name },
    });
  }

  protected async getMemory<T>(context: string): Promise<T | null> {
    return redis.getAgentMemory<T>(this.name, context);
  }

  protected async setMemory(context: string, data: unknown, ttl?: number): Promise<void> {
    await redis.setAgentMemory(this.name, context, data, ttl);
  }

  protected publishEvent(type: EventType, sessionId: string, tenantId: string, data: unknown): void {
    const payload: EventPayload = {
      type,
      sessionId,
      tenantId,
      timestamp: new Date().toISOString(),
      data,
      metadata: { agentName: this.name },
    };
    eventBus.publish(payload);
  }

  protected parseJSON<T>(content: string): T | null {
    try {
      // Handle markdown code blocks
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned) as T;
    } catch {
      return null;
    }
  }

  abstract execute(context: AgentContext): Promise<AgentResult>;
}
