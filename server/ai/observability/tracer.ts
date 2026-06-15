/**
 * 蓉才通™ ATOS — Observability Tracer
 * 
 * 分布式追踪系统，对标：
 * - LangSmith Tracing
 * - OpenTelemetry
 * - Datadog APM
 * - Langfuse
 * 
 * 功能：
 * - Distributed Tracing（分布式链路追踪）
 * - Span Hierarchy（Agent → Sub-Agent → LLM Call → Tool Call）
 * - Token Metering（Token 计量）
 * - Cost Tracking（成本追踪）
 * - Latency Profiling（延迟分析）
 * - Error Tracking（错误追踪）
 * - Structured Logging（结构化日志）
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type SpanKind = 'agent' | 'llm' | 'tool' | 'retrieval' | 'embedding' | 'workflow' | 'custom';
export type SpanStatus = 'running' | 'success' | 'error' | 'timeout' | 'cancelled';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface Trace {
  id: string;
  name: string;
  tenantId: string;
  userId?: string;
  sessionId?: string;
  startTime: string;
  endTime?: string;
  duration_ms?: number;
  status: SpanStatus;
  rootSpanId: string;
  spans: Span[];
  metadata: TraceMetadata;
  tags: string[];
}

export interface Span {
  id: string;
  traceId: string;
  parentId?: string;
  name: string;
  kind: SpanKind;
  status: SpanStatus;
  startTime: string;
  endTime?: string;
  duration_ms?: number;
  input?: unknown;
  output?: unknown;
  error?: SpanError;
  metrics: SpanMetrics;
  attributes: Record<string, unknown>;
  events: SpanEvent[];
  children: string[];  // child span IDs
}

export interface SpanMetrics {
  tokenUsage?: { prompt: number; completion: number; total: number };
  cost_usd?: number;
  latency_ms?: number;
  retries?: number;
  cacheHit?: boolean;
}

export interface SpanError {
  type: string;
  message: string;
  stack?: string;
  retryable: boolean;
}

export interface SpanEvent {
  name: string;
  timestamp: string;
  attributes: Record<string, unknown>;
}

export interface TraceMetadata {
  agentName: string;
  model?: string;
  totalTokens: number;
  totalCost_usd: number;
  totalLatency_ms: number;
  spanCount: number;
  errorCount: number;
}

// ─── Metrics Aggregation ─────────────────────────────────────────────────────

export interface AgentMetrics {
  agentName: string;
  period: string;  // "2024-01-15" or "2024-W03"
  invocations: number;
  successRate: number;
  avgLatency_ms: number;
  p95Latency_ms: number;
  p99Latency_ms: number;
  totalTokens: number;
  totalCost_usd: number;
  errorRate: number;
  errorBreakdown: Record<string, number>;
  topErrors: Array<{ message: string; count: number }>;
}

export interface SystemMetrics {
  timestamp: string;
  activeTraces: number;
  queueDepth: number;
  memoryUsage_mb: number;
  cpuUsage_pct: number;
  redisConnections: number;
  dbConnections: number;
  llmRpm: number;
  llmTpm: number;
}

// ─── Tracer Implementation ───────────────────────────────────────────────────

export class Tracer {
  private activeTraces: Map<string, Trace> = new Map();
  private completedTraces: Trace[] = [];
  private maxCompletedTraces = 1000;

  /**
   * Start a new trace (top-level operation).
   */
  startTrace(name: string, tenantId: string, options?: {
    userId?: string;
    sessionId?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): TraceContext {
    const traceId = this.generateId('trc');
    const rootSpanId = this.generateId('spn');
    const now = new Date().toISOString();

    const trace: Trace = {
      id: traceId,
      name,
      tenantId,
      userId: options?.userId,
      sessionId: options?.sessionId,
      startTime: now,
      status: 'running',
      rootSpanId,
      spans: [],
      metadata: {
        agentName: name,
        totalTokens: 0,
        totalCost_usd: 0,
        totalLatency_ms: 0,
        spanCount: 0,
        errorCount: 0,
      },
      tags: options?.tags || [],
    };

    // Create root span
    const rootSpan: Span = {
      id: rootSpanId,
      traceId,
      name,
      kind: 'agent',
      status: 'running',
      startTime: now,
      metrics: {},
      attributes: options?.metadata || {},
      events: [],
      children: [],
    };

    trace.spans.push(rootSpan);
    this.activeTraces.set(traceId, trace);

    return new TraceContext(this, traceId, rootSpanId);
  }

  /**
   * End a trace.
   */
  endTrace(traceId: string, status: SpanStatus = 'success'): Trace | null {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return null;

    const now = new Date().toISOString();
    trace.endTime = now;
    trace.status = status;
    trace.duration_ms = new Date(now).getTime() - new Date(trace.startTime).getTime();

    // End any running spans
    for (const span of trace.spans) {
      if (span.status === 'running') {
        span.endTime = now;
        span.status = status;
        span.duration_ms = new Date(now).getTime() - new Date(span.startTime).getTime();
      }
    }

    // Compute metadata
    trace.metadata.spanCount = trace.spans.length;
    trace.metadata.totalLatency_ms = trace.duration_ms;
    trace.metadata.totalTokens = trace.spans.reduce((sum, s) => sum + (s.metrics.tokenUsage?.total || 0), 0);
    trace.metadata.totalCost_usd = trace.spans.reduce((sum, s) => sum + (s.metrics.cost_usd || 0), 0);
    trace.metadata.errorCount = trace.spans.filter(s => s.status === 'error').length;

    // Move to completed
    this.activeTraces.delete(traceId);
    this.completedTraces.push(trace);
    if (this.completedTraces.length > this.maxCompletedTraces) {
      this.completedTraces.shift();
    }

    // Emit to persistence layer
    this.persistTrace(trace);

    return trace;
  }

  /**
   * Start a child span within a trace.
   */
  startSpan(traceId: string, parentSpanId: string, name: string, kind: SpanKind, input?: unknown): string {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return '';

    const spanId = this.generateId('spn');
    const now = new Date().toISOString();

    const span: Span = {
      id: spanId,
      traceId,
      parentId: parentSpanId,
      name,
      kind,
      status: 'running',
      startTime: now,
      input,
      metrics: {},
      attributes: {},
      events: [],
      children: [],
    };

    trace.spans.push(span);

    // Link to parent
    const parent = trace.spans.find(s => s.id === parentSpanId);
    if (parent) {
      parent.children.push(spanId);
    }

    return spanId;
  }

  /**
   * End a span with results.
   */
  endSpan(traceId: string, spanId: string, result: {
    status?: SpanStatus;
    output?: unknown;
    error?: SpanError;
    metrics?: Partial<SpanMetrics>;
    attributes?: Record<string, unknown>;
  }): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;

    const span = trace.spans.find(s => s.id === spanId);
    if (!span) return;

    const now = new Date().toISOString();
    span.endTime = now;
    span.duration_ms = new Date(now).getTime() - new Date(span.startTime).getTime();
    span.status = result.status || 'success';
    span.output = result.output;
    span.error = result.error;
    span.metrics = { ...span.metrics, ...result.metrics, latency_ms: span.duration_ms };
    span.attributes = { ...span.attributes, ...result.attributes };
  }

  /**
   * Add an event to a span.
   */
  addEvent(traceId: string, spanId: string, name: string, attributes: Record<string, unknown> = {}): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;

    const span = trace.spans.find(s => s.id === spanId);
    if (!span) return;

    span.events.push({
      name,
      timestamp: new Date().toISOString(),
      attributes,
    });
  }

  // ─── Query ───────────────────────────────────────────────────────────────

  getTrace(traceId: string): Trace | undefined {
    return this.activeTraces.get(traceId) || this.completedTraces.find(t => t.id === traceId);
  }

  getActiveTraces(): Trace[] {
    return [...this.activeTraces.values()];
  }

  getRecentTraces(limit = 50): Trace[] {
    return this.completedTraces.slice(-limit).reverse();
  }

  getTracesByAgent(agentName: string, limit = 20): Trace[] {
    return this.completedTraces
      .filter(t => t.metadata.agentName === agentName)
      .slice(-limit)
      .reverse();
  }

  /**
   * Compute aggregate metrics for an agent over a time period.
   */
  getAgentMetrics(agentName: string, since?: string): AgentMetrics {
    const sinceTime = since ? new Date(since).getTime() : Date.now() - 86400000; // last 24h
    const traces = this.completedTraces.filter(t => 
      t.metadata.agentName === agentName && 
      new Date(t.startTime).getTime() >= sinceTime
    );

    const latencies = traces.map(t => t.duration_ms || 0).sort((a, b) => a - b);
    const errors = traces.filter(t => t.status === 'error');

    const errorBreakdown: Record<string, number> = {};
    for (const t of errors) {
      const errSpans = t.spans.filter(s => s.error);
      for (const s of errSpans) {
        const key = s.error?.type || 'unknown';
        errorBreakdown[key] = (errorBreakdown[key] || 0) + 1;
      }
    }

    return {
      agentName,
      period: new Date().toISOString().split('T')[0],
      invocations: traces.length,
      successRate: traces.length > 0 ? (traces.length - errors.length) / traces.length : 0,
      avgLatency_ms: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      p95Latency_ms: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0,
      p99Latency_ms: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] : 0,
      totalTokens: traces.reduce((sum, t) => sum + t.metadata.totalTokens, 0),
      totalCost_usd: traces.reduce((sum, t) => sum + t.metadata.totalCost_usd, 0),
      errorRate: traces.length > 0 ? errors.length / traces.length : 0,
      errorBreakdown,
      topErrors: Object.entries(errorBreakdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([message, count]) => ({ message, count })),
    };
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private persistTrace(trace: Trace): void {
    // In production: write to Postgres / ClickHouse / external observability platform
    // For now: structured log
    console.log(JSON.stringify({
      level: 'info',
      type: 'trace_complete',
      traceId: trace.id,
      name: trace.name,
      status: trace.status,
      duration_ms: trace.duration_ms,
      tokens: trace.metadata.totalTokens,
      cost_usd: trace.metadata.totalCost_usd,
      spans: trace.metadata.spanCount,
      errors: trace.metadata.errorCount,
      timestamp: trace.endTime,
    }));
  }
}

// ─── Trace Context (Fluent API) ──────────────────────────────────────────────

export class TraceContext {
  constructor(
    private tracer: Tracer,
    public readonly traceId: string,
    public readonly currentSpanId: string
  ) {}

  /**
   * Start a child span and return a new context.
   */
  span(name: string, kind: SpanKind, input?: unknown): SpanContext {
    const spanId = this.tracer.startSpan(this.traceId, this.currentSpanId, name, kind, input);
    return new SpanContext(this.tracer, this.traceId, spanId);
  }

  /**
   * End the trace.
   */
  end(status: SpanStatus = 'success'): Trace | null {
    return this.tracer.endTrace(this.traceId, status);
  }

  /**
   * Add event to root span.
   */
  event(name: string, attributes?: Record<string, unknown>): void {
    this.tracer.addEvent(this.traceId, this.currentSpanId, name, attributes);
  }
}

export class SpanContext {
  constructor(
    private tracer: Tracer,
    public readonly traceId: string,
    public readonly spanId: string
  ) {}

  /**
   * Start a child span.
   */
  span(name: string, kind: SpanKind, input?: unknown): SpanContext {
    const childId = this.tracer.startSpan(this.traceId, this.spanId, name, kind, input);
    return new SpanContext(this.tracer, this.traceId, childId);
  }

  /**
   * End this span with success.
   */
  end(output?: unknown, metrics?: Partial<SpanMetrics>): void {
    this.tracer.endSpan(this.traceId, this.spanId, { status: 'success', output, metrics });
  }

  /**
   * End this span with error.
   */
  error(err: Error | string, retryable = false): void {
    const error: SpanError = {
      type: err instanceof Error ? err.constructor.name : 'Error',
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      retryable,
    };
    this.tracer.endSpan(this.traceId, this.spanId, { status: 'error', error });
  }

  /**
   * Add event to this span.
   */
  event(name: string, attributes?: Record<string, unknown>): void {
    this.tracer.addEvent(this.traceId, this.spanId, name, attributes);
  }
}

// ─── Structured Logger ───────────────────────────────────────────────────────

export class StructuredLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 5000;

  log(level: LogLevel, message: string, context: Record<string, unknown> = {}): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) this.logs.shift();

    // Also output to console in structured format
    const logFn = level === 'error' || level === 'fatal' ? console.error :
                  level === 'warn' ? console.warn : console.log;
    logFn(JSON.stringify(entry));
  }

  debug(msg: string, ctx?: Record<string, unknown>) { this.log('debug', msg, ctx); }
  info(msg: string, ctx?: Record<string, unknown>) { this.log('info', msg, ctx); }
  warn(msg: string, ctx?: Record<string, unknown>) { this.log('warn', msg, ctx); }
  error(msg: string, ctx?: Record<string, unknown>) { this.log('error', msg, ctx); }

  getRecent(limit = 100, level?: LogLevel): LogEntry[] {
    const filtered = level ? this.logs.filter(l => l.level === level) : this.logs;
    return filtered.slice(-limit);
  }
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

// ─── Singletons ──────────────────────────────────────────────────────────────

export const tracer = new Tracer();
export const logger = new StructuredLogger();
