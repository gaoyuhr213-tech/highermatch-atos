/**
 * 蓉才通™ ATOS — LLM Client Abstraction
 * 
 * 统一的LLM调用层，支持：
 * - OpenAI GPT-4o / GPT-4o-mini
 * - Azure OpenAI
 * - 本地部署（Ollama / vLLM）
 * - 流式输出（SSE）
 * - Token计量 & 成本追踪
 * - 重试 & 降级
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface LLMToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMCompletionRequest {
  model?: string;
  messages: LLMMessage[];
  tools?: LLMToolDefinition[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
  stream?: boolean;
  metadata?: {
    tenantId: string;
    agentName: string;
    sessionId?: string;
  };
}

export interface LLMCompletionResponse {
  id: string;
  content: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
  latency_ms: number;
}

export interface LLMStreamChunk {
  id: string;
  delta: string;
  finish_reason?: string;
}

export interface LLMClientConfig {
  provider: 'openai' | 'azure' | 'local';
  apiKey: string;
  baseUrl?: string;
  defaultModel: string;
  fallbackModel?: string;
  maxRetries: number;
  timeoutMs: number;
  rateLimitRpm: number;
}

const DEFAULT_CONFIG: LLMClientConfig = {
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY || '',
  defaultModel: 'gpt-4o',
  fallbackModel: 'gpt-4o-mini',
  maxRetries: 3,
  timeoutMs: 60_000,
  rateLimitRpm: 500,
};

class LLMClient {
  private config: LLMClientConfig;
  private requestCount = 0;
  private lastResetTime = Date.now();

  constructor(config: Partial<LLMClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    this.checkRateLimit();
    const model = request.model || this.config.defaultModel;
    const startTime = Date.now();

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.callProvider(model, request);
        return {
          ...response,
          latency_ms: Date.now() - startTime,
        };
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        if (attempt === this.config.maxRetries) {
          // Try fallback model on final attempt
          if (this.config.fallbackModel && model !== this.config.fallbackModel) {
            return this.complete({ ...request, model: this.config.fallbackModel });
          }
          throw error;
        }
        // Retry on 429 (rate limit) or 5xx
        if (err.status === 429 || (err.status && err.status >= 500)) {
          await this.sleep(Math.pow(2, attempt) * 1000);
          continue;
        }
        throw error;
      }
    }
    throw new Error('LLM request exhausted all retries');
  }

  async *stream(request: LLMCompletionRequest): AsyncGenerator<LLMStreamChunk> {
    this.checkRateLimit();
    const model = request.model || this.config.defaultModel;
    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 4096,
        stream: true,
        ...(request.response_format && { response_format: request.response_format }),
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM stream error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            const finishReason = parsed.choices?.[0]?.finish_reason;
            if (delta || finishReason) {
              yield { id: parsed.id, delta, finish_reason: finishReason };
            }
          } catch { /* skip malformed chunks */ }
        }
      }
    }
  }

  private async callProvider(model: string, request: LLMCompletionRequest): Promise<Omit<LLMCompletionResponse, 'latency_ms'>> {
    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';

    const body: Record<string, unknown> = {
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 4096,
    };
    if (request.tools) body.tools = request.tools;
    if (request.tool_choice) body.tool_choice = request.tool_choice;
    if (request.response_format) body.response_format = request.response_format;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw { status: response.status, message: (errorBody as Record<string, unknown>).error || response.statusText };
      }

      const data = await response.json() as Record<string, unknown>;
      const choice = (data.choices as Array<Record<string, unknown>>)?.[0];
      const message = choice?.message as Record<string, unknown>;
      const usage = data.usage as Record<string, number>;

      return {
        id: data.id as string,
        content: (message?.content as string) || '',
        tool_calls: message?.tool_calls as LLMCompletionResponse['tool_calls'],
        usage: {
          prompt_tokens: usage?.prompt_tokens || 0,
          completion_tokens: usage?.completion_tokens || 0,
          total_tokens: usage?.total_tokens || 0,
        },
        model: data.model as string,
        finish_reason: (choice?.finish_reason as LLMCompletionResponse['finish_reason']) || 'stop',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private checkRateLimit(): void {
    const now = Date.now();
    if (now - this.lastResetTime > 60_000) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }
    if (this.requestCount >= this.config.rateLimitRpm) {
      throw new Error(`Rate limit exceeded: ${this.config.rateLimitRpm} RPM`);
    }
    this.requestCount++;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton
export const llm = new LLMClient();

// Factory for custom configs
export function createLLMClient(config: Partial<LLMClientConfig>): LLMClient {
  return new LLMClient(config);
}
