/**
 * Phase 13-C: Production Hardening
 * 
 * 工业级生产加固：熔断 + 限流 + 重试 + 舱壁 + 死信 + 健康检查 + SLO/SLA
 * 
 * 对标: Netflix Hystrix / Resilience4j / Polly / AWS Well-Architected
 * 
 * 核心能力：
 * 1. Circuit Breaker（熔断器）
 * 2. Rate Limiter（多维限流）
 * 3. Retry + Backoff + Jitter
 * 4. Bulkhead（舱壁隔离）
 * 5. Dead Letter Queue
 * 6. Health Check
 * 7. Graceful Shutdown
 * 8. SLO/SLA
 * 9. Capacity Planning
 * 10. Cost Guardrail
 * 11. Chaos Engineering
 */

// ============================================================
// Circuit Breaker（熔断器）
// ============================================================

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;      // 触发熔断的失败次数
  successThreshold: number;      // 半开→关闭所需成功次数
  timeout: number;               // 熔断持续时间(ms)
  monitorWindow: number;         // 监控窗口(ms)
  volumeThreshold: number;       // 最小请求量才触发熔断
  failureRateThreshold: number;  // 失败率阈值(0-1)
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number = 0;
  private totalRequests: number = 0;
  private windowStart: number = Date.now();
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  /**
   * 执行受保护的操作
   */
  async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      if (fallback) return fallback();
      throw new CircuitOpenError(this.config.name, this.getTimeUntilRetry());
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback && this.state === 'open') return fallback();
      throw error;
    }
  }

  getState(): CircuitState { return this.state; }
  getMetrics(): CircuitMetrics {
    return {
      name: this.config.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalRequests: this.totalRequests,
      failureRate: this.totalRequests > 0 ? this.failures / this.totalRequests : 0,
    };
  }

  private canExecute(): boolean {
    this.resetWindowIfNeeded();

    switch (this.state) {
      case 'closed': return true;
      case 'open':
        if (Date.now() - this.lastFailureTime >= this.config.timeout) {
          this.state = 'half_open';
          return true;
        }
        return false;
      case 'half_open': return true;
    }
  }

  private onSuccess(): void {
    this.totalRequests++;
    if (this.state === 'half_open') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = 'closed';
        this.reset();
      }
    }
  }

  private onFailure(): void {
    this.totalRequests++;
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half_open') {
      this.state = 'open';
      return;
    }

    if (this.totalRequests >= this.config.volumeThreshold) {
      const failureRate = this.failures / this.totalRequests;
      if (failureRate >= this.config.failureRateThreshold || this.failures >= this.config.failureThreshold) {
        this.state = 'open';
      }
    }
  }

  private reset(): void {
    this.failures = 0;
    this.successes = 0;
    this.totalRequests = 0;
  }

  private resetWindowIfNeeded(): void {
    if (Date.now() - this.windowStart >= this.config.monitorWindow) {
      this.windowStart = Date.now();
      this.reset();
    }
  }

  private getTimeUntilRetry(): number {
    return Math.max(0, this.config.timeout - (Date.now() - this.lastFailureTime));
  }
}

export class CircuitOpenError extends Error {
  constructor(public circuitName: string, public retryAfterMs: number) {
    super(`Circuit breaker '${circuitName}' is OPEN. Retry after ${retryAfterMs}ms`);
  }
}

export interface CircuitMetrics {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  totalRequests: number;
  failureRate: number;
}

// ============================================================
// Rate Limiter（多维限流）
// ============================================================

export type RateLimitDimension = 'ip' | 'user' | 'tenant' | 'api_key' | 'endpoint';

export interface RateLimitConfig {
  dimension: RateLimitDimension;
  maxRequests: number;
  windowMs: number;
  burstSize?: number;
  penalty?: { durationMs: number; threshold: number };
}

export class RateLimiter {
  private windows: Map<string, { count: number; resetAt: number; penaltyUntil?: number }> = new Map();
  private configs: RateLimitConfig[] = [];

  /**
   * 注册限流规则
   */
  registerConfig(config: RateLimitConfig): void {
    this.configs.push(config);
  }

  /**
   * 检查是否允许请求
   */
  checkLimit(params: {
    ip?: string;
    userId?: string;
    tenantId?: string;
    apiKey?: string;
    endpoint?: string;
  }): RateLimitResult {
    for (const config of this.configs) {
      const key = this.buildKey(config.dimension, params);
      if (!key) continue;

      const result = this.checkWindow(key, config);
      if (!result.allowed) return result;
    }

    return { allowed: true, remaining: Infinity, resetAt: 0 };
  }

  /**
   * 消费一个请求配额
   */
  consume(params: {
    ip?: string;
    userId?: string;
    tenantId?: string;
    apiKey?: string;
    endpoint?: string;
  }): RateLimitResult {
    const checkResult = this.checkLimit(params);
    if (!checkResult.allowed) return checkResult;

    // 对每个维度消费配额
    for (const config of this.configs) {
      const key = this.buildKey(config.dimension, params);
      if (!key) continue;

      const window = this.getOrCreateWindow(key, config);
      window.count++;

      // 惩罚机制
      if (config.penalty && window.count >= config.penalty.threshold) {
        window.penaltyUntil = Date.now() + config.penalty.durationMs;
      }
    }

    return checkResult;
  }

  private checkWindow(key: string, config: RateLimitConfig): RateLimitResult {
    const window = this.getOrCreateWindow(key, config);

    // 检查惩罚
    if (window.penaltyUntil && Date.now() < window.penaltyUntil) {
      return { allowed: false, remaining: 0, resetAt: window.penaltyUntil, reason: 'penalty' };
    }

    if (window.count >= config.maxRequests) {
      return { allowed: false, remaining: 0, resetAt: window.resetAt, reason: 'rate_exceeded' };
    }

    return { allowed: true, remaining: config.maxRequests - window.count, resetAt: window.resetAt };
  }

  private getOrCreateWindow(key: string, config: RateLimitConfig): { count: number; resetAt: number; penaltyUntil?: number } {
    const existing = this.windows.get(key);
    const now = Date.now();

    if (!existing || now >= existing.resetAt) {
      const window = { count: 0, resetAt: now + config.windowMs };
      this.windows.set(key, window);
      return window;
    }

    return existing;
  }

  private buildKey(dimension: RateLimitDimension, params: Record<string, string | undefined>): string | null {
    const value = params[dimension === 'api_key' ? 'apiKey' : dimension === 'user' ? 'userId' : dimension];
    return value ? `rl:${dimension}:${value}` : null;
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  reason?: string;
}

// ============================================================
// Retry Engine
// ============================================================

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;        // ms
  maxDelay: number;         // ms
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors?: string[];
  nonRetryableErrors?: string[];
}

export class RetryEngine {
  /**
   * 带重试的执行
   */
  async execute<T>(fn: () => Promise<T>, config: RetryConfig): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (!this.isRetryable(error as Error, config)) throw error;
        if (attempt === config.maxAttempts) break;

        const delay = this.calculateDelay(attempt, config);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, config.maxDelay);

    if (config.jitter) {
      delay = delay * (0.5 + Math.random()); // Full jitter
    }

    return delay;
  }

  private isRetryable(error: Error, config: RetryConfig): boolean {
    if (config.nonRetryableErrors?.some(e => error.message.includes(e))) return false;
    if (config.retryableErrors?.length) {
      return config.retryableErrors.some(e => error.message.includes(e));
    }
    return true; // 默认可重试
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================
// Bulkhead（舱壁隔离）
// ============================================================

export interface BulkheadConfig {
  name: string;
  maxConcurrent: number;
  maxQueue: number;
  queueTimeout: number; // ms
}

export class Bulkhead {
  private active: number = 0;
  private queue: Array<{ resolve: () => void; reject: (err: Error) => void; timeout: NodeJS.Timeout }> = [];
  private config: BulkheadConfig;

  constructor(config: BulkheadConfig) {
    this.config = config;
  }

  /**
   * 在舱壁内执行
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  getMetrics(): { active: number; queued: number; maxConcurrent: number } {
    return { active: this.active, queued: this.queue.length, maxConcurrent: this.config.maxConcurrent };
  }

  private acquire(): Promise<void> {
    if (this.active < this.config.maxConcurrent) {
      this.active++;
      return Promise.resolve();
    }

    if (this.queue.length >= this.config.maxQueue) {
      return Promise.reject(new BulkheadFullError(this.config.name));
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const idx = this.queue.findIndex(item => item.resolve === resolve);
        if (idx >= 0) this.queue.splice(idx, 1);
        reject(new BulkheadTimeoutError(this.config.name));
      }, this.config.queueTimeout);

      this.queue.push({ resolve, reject, timeout });
    });
  }

  private release(): void {
    this.active--;
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      clearTimeout(next.timeout);
      this.active++;
      next.resolve();
    }
  }
}

export class BulkheadFullError extends Error {
  constructor(name: string) { super(`Bulkhead '${name}' is full`); }
}
export class BulkheadTimeoutError extends Error {
  constructor(name: string) { super(`Bulkhead '${name}' queue timeout`); }
}

// ============================================================
// Dead Letter Queue
// ============================================================

export interface DeadLetterEntry {
  id: string;
  queue: string;
  payload: unknown;
  error: string;
  attempts: number;
  maxAttempts: number;
  firstFailedAt: number;
  lastFailedAt: number;
  status: 'pending' | 'retrying' | 'exhausted' | 'resolved';
}

export class DeadLetterQueue {
  private entries: Map<string, DeadLetterEntry> = new Map();

  /**
   * 将失败消息放入死信队列
   */
  enqueue(params: {
    queue: string;
    payload: unknown;
    error: string;
    attempts: number;
    maxAttempts: number;
  }): DeadLetterEntry {
    const entry: DeadLetterEntry = {
      id: `dlq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      queue: params.queue,
      payload: params.payload,
      error: params.error,
      attempts: params.attempts,
      maxAttempts: params.maxAttempts,
      firstFailedAt: Date.now(),
      lastFailedAt: Date.now(),
      status: params.attempts >= params.maxAttempts ? 'exhausted' : 'pending',
    };

    this.entries.set(entry.id, entry);
    return entry;
  }

  /**
   * 重试死信
   */
  async retry(entryId: string, handler: (payload: unknown) => Promise<void>): Promise<boolean> {
    const entry = this.entries.get(entryId);
    if (!entry || entry.status === 'resolved') return false;

    entry.status = 'retrying';
    entry.attempts++;

    try {
      await handler(entry.payload);
      entry.status = 'resolved';
      return true;
    } catch (error) {
      entry.lastFailedAt = Date.now();
      entry.error = (error as Error).message;
      entry.status = entry.attempts >= entry.maxAttempts ? 'exhausted' : 'pending';
      return false;
    }
  }

  /**
   * 查询死信
   */
  query(params: { queue?: string; status?: DeadLetterEntry['status']; limit?: number }): DeadLetterEntry[] {
    let results = Array.from(this.entries.values());
    if (params.queue) results = results.filter(e => e.queue === params.queue);
    if (params.status) results = results.filter(e => e.status === params.status);
    return results.sort((a, b) => b.lastFailedAt - a.lastFailedAt).slice(0, params.limit || 50);
  }
}

// ============================================================
// Health Check
// ============================================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: number;
  uptime: number;
  version: string;
  checks: ComponentHealth[];
}

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  latency?: number;
  message?: string;
  lastChecked: number;
}

export class HealthChecker {
  private startTime = Date.now();
  private checks: Map<string, () => Promise<ComponentHealth>> = new Map();

  /**
   * 注册健康检查
   */
  register(name: string, check: () => Promise<ComponentHealth>): void {
    this.checks.set(name, check);
  }

  /**
   * 执行全部健康检查
   */
  async check(): Promise<HealthCheckResult> {
    const results: ComponentHealth[] = [];

    for (const [name, checkFn] of this.checks) {
      try {
        const start = Date.now();
        const result = await Promise.race([
          checkFn(),
          new Promise<ComponentHealth>((_, reject) => 
            setTimeout(() => reject(new Error('timeout')), 5000)
          ),
        ]);
        result.latency = Date.now() - start;
        results.push(result);
      } catch (error) {
        results.push({
          name,
          status: 'unhealthy',
          message: (error as Error).message,
          lastChecked: Date.now(),
        });
      }
    }

    const overallStatus = this.calculateOverallStatus(results);

    return {
      status: overallStatus,
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      version: process.env.APP_VERSION || '1.0.0',
      checks: results,
    };
  }

  /**
   * 快速存活检查（K8S liveness probe）
   */
  async liveness(): Promise<{ alive: boolean }> {
    return { alive: true };
  }

  /**
   * 就绪检查（K8S readiness probe）
   */
  async readiness(): Promise<{ ready: boolean; reason?: string }> {
    const health = await this.check();
    return {
      ready: health.status !== 'unhealthy',
      reason: health.status === 'unhealthy' ? 'dependencies_unhealthy' : undefined,
    };
  }

  private calculateOverallStatus(checks: ComponentHealth[]): HealthStatus {
    if (checks.some(c => c.status === 'unhealthy')) return 'unhealthy';
    if (checks.some(c => c.status === 'degraded')) return 'degraded';
    return 'healthy';
  }
}

// ============================================================
// SLO / SLA
// ============================================================

export interface SLODefinition {
  id: string;
  name: string;
  type: 'availability' | 'latency' | 'error_rate' | 'throughput';
  target: number;
  window: 'rolling_7d' | 'rolling_30d' | 'calendar_month';
  burnRateThreshold: number; // 消耗速率告警阈值
}

export interface SLOStatus {
  definition: SLODefinition;
  current: number;
  target: number;
  budget: number;          // 剩余错误预算
  budgetConsumed: number;  // 已消耗百分比
  burnRate: number;        // 当前消耗速率
  isBreaching: boolean;
  projectedBreach?: number; // 预计突破时间
}

export class SLOMonitor {
  private definitions: SLODefinition[] = [];
  private dataPoints: Map<string, Array<{ timestamp: number; value: number }>> = new Map();

  /**
   * 注册SLO
   */
  registerSLO(definition: SLODefinition): void {
    this.definitions.push(definition);
    this.dataPoints.set(definition.id, []);
  }

  /**
   * 记录数据点
   */
  recordDataPoint(sloId: string, value: number): void {
    const points = this.dataPoints.get(sloId);
    if (points) {
      points.push({ timestamp: Date.now(), value });
      // 保留最近30天数据
      const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const idx = points.findIndex(p => p.timestamp >= cutoff);
      if (idx > 0) points.splice(0, idx);
    }
  }

  /**
   * 获取所有SLO状态
   */
  getStatus(): SLOStatus[] {
    return this.definitions.map(def => this.calculateStatus(def));
  }

  private calculateStatus(def: SLODefinition): SLOStatus {
    const points = this.dataPoints.get(def.id) || [];
    const windowMs = def.window === 'rolling_7d' ? 7 * 86400000 : 30 * 86400000;
    const cutoff = Date.now() - windowMs;
    const windowPoints = points.filter(p => p.timestamp >= cutoff);

    const current = windowPoints.length > 0
      ? windowPoints.reduce((sum, p) => sum + p.value, 0) / windowPoints.length
      : def.target;

    const budget = def.target - (1 - def.target); // 简化的错误预算
    const budgetConsumed = Math.max(0, (def.target - current) / (1 - def.target));

    // 计算消耗速率（最近1小时 vs 窗口平均）
    const recentCutoff = Date.now() - 3600000;
    const recentPoints = windowPoints.filter(p => p.timestamp >= recentCutoff);
    const recentAvg = recentPoints.length > 0
      ? recentPoints.reduce((sum, p) => sum + p.value, 0) / recentPoints.length
      : current;
    const burnRate = (def.target - recentAvg) / (1 - def.target);

    return {
      definition: def,
      current,
      target: def.target,
      budget,
      budgetConsumed,
      burnRate,
      isBreaching: current < def.target,
      projectedBreach: burnRate > def.burnRateThreshold
        ? Date.now() + ((1 - budgetConsumed) / burnRate) * windowMs
        : undefined,
    };
  }
}

// ============================================================
// Cost Guardrail
// ============================================================

export interface CostGuardrailConfig {
  tenantId: string;
  monthlyBudget: number;       // USD
  dailyLimit: number;
  perRequestLimit: number;
  alertThresholds: number[];   // [0.5, 0.8, 0.95]
  autoThrottle: boolean;       // 超限自动降级
  throttleStrategy: 'reject' | 'queue' | 'downgrade_model';
}

export class CostGuardrail {
  private configs: Map<string, CostGuardrailConfig> = new Map();
  private spending: Map<string, { daily: number; monthly: number; lastReset: number }> = new Map();

  /**
   * 注册成本护栏
   */
  registerConfig(config: CostGuardrailConfig): void {
    this.configs.set(config.tenantId, config);
  }

  /**
   * 检查是否允许LLM调用
   */
  checkBudget(tenantId: string, estimatedCost: number): CostCheckResult {
    const config = this.configs.get(tenantId);
    if (!config) return { allowed: true, action: 'proceed' };

    const spend = this.getSpending(tenantId);
    this.resetIfNeeded(spend);

    // 单次请求限制
    if (estimatedCost > config.perRequestLimit) {
      return { allowed: false, action: 'reject', reason: 'per_request_limit_exceeded' };
    }

    // 日限额
    if (spend.daily + estimatedCost > config.dailyLimit) {
      return config.autoThrottle
        ? { allowed: true, action: config.throttleStrategy, reason: 'daily_limit_approaching' }
        : { allowed: false, action: 'reject', reason: 'daily_limit_exceeded' };
    }

    // 月预算
    const monthlyUsageRate = spend.monthly / config.monthlyBudget;
    const alert = config.alertThresholds.find(t => monthlyUsageRate >= t);
    if (alert && monthlyUsageRate >= 0.95) {
      return config.autoThrottle
        ? { allowed: true, action: 'downgrade_model', reason: 'monthly_budget_critical' }
        : { allowed: false, action: 'reject', reason: 'monthly_budget_exceeded' };
    }

    return { allowed: true, action: 'proceed', alert: alert ? `budget_${Math.round(alert * 100)}%` : undefined };
  }

  /**
   * 记录支出
   */
  recordSpend(tenantId: string, cost: number): void {
    const spend = this.getSpending(tenantId);
    spend.daily += cost;
    spend.monthly += cost;
  }

  private getSpending(tenantId: string): { daily: number; monthly: number; lastReset: number } {
    if (!this.spending.has(tenantId)) {
      this.spending.set(tenantId, { daily: 0, monthly: 0, lastReset: Date.now() });
    }
    return this.spending.get(tenantId)!;
  }

  private resetIfNeeded(spend: { daily: number; monthly: number; lastReset: number }): void {
    const now = Date.now();
    const dayMs = 86400000;
    if (now - spend.lastReset >= dayMs) {
      spend.daily = 0;
      spend.lastReset = now;
    }
  }
}

export interface CostCheckResult {
  allowed: boolean;
  action: 'proceed' | 'reject' | 'queue' | 'downgrade_model';
  reason?: string;
  alert?: string;
}

// ============================================================
// Chaos Engineering Toolkit
// ============================================================

export interface ChaosExperiment {
  id: string;
  name: string;
  type: 'latency' | 'failure' | 'resource_exhaustion' | 'network_partition' | 'data_corruption';
  target: string;
  config: Record<string, unknown>;
  duration: number; // ms
  status: 'pending' | 'running' | 'completed' | 'aborted';
  startedAt?: number;
  results?: ChaosResult;
}

export interface ChaosResult {
  hypothesis: string;
  validated: boolean;
  observations: string[];
  metrics: Record<string, number>;
  recommendations: string[];
}

export class ChaosEngine {
  private experiments: Map<string, ChaosExperiment> = new Map();
  private activeInjections: Map<string, { type: string; config: Record<string, unknown> }> = new Map();

  /**
   * 创建混沌实验
   */
  createExperiment(params: Omit<ChaosExperiment, 'id' | 'status'>): ChaosExperiment {
    const experiment: ChaosExperiment = {
      ...params,
      id: `chaos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: 'pending',
    };
    this.experiments.set(experiment.id, experiment);
    return experiment;
  }

  /**
   * 启动实验
   */
  async startExperiment(experimentId: string): Promise<void> {
    const exp = this.experiments.get(experimentId);
    if (!exp) throw new Error('Experiment not found');

    exp.status = 'running';
    exp.startedAt = Date.now();

    // 注入故障
    this.activeInjections.set(exp.target, { type: exp.type, config: exp.config });

    // 自动停止
    setTimeout(() => this.stopExperiment(experimentId), exp.duration);
  }

  /**
   * 停止实验
   */
  stopExperiment(experimentId: string): void {
    const exp = this.experiments.get(experimentId);
    if (!exp) return;

    this.activeInjections.delete(exp.target);
    exp.status = 'completed';
  }

  /**
   * 检查是否有活跃的故障注入
   */
  shouldInjectFault(target: string): { inject: boolean; type?: string; config?: Record<string, unknown> } {
    const injection = this.activeInjections.get(target);
    if (!injection) return { inject: false };
    return { inject: true, type: injection.type, config: injection.config };
  }
}

// ============================================================
// Graceful Shutdown
// ============================================================

export class GracefulShutdown {
  private shutdownHandlers: Array<{ name: string; handler: () => Promise<void>; priority: number }> = [];
  private isShuttingDown = false;

  /**
   * 注册关闭处理器
   */
  register(name: string, handler: () => Promise<void>, priority: number = 0): void {
    this.shutdownHandlers.push({ name, handler, priority });
    this.shutdownHandlers.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 执行优雅关闭
   */
  async shutdown(timeoutMs: number = 30000): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    const timeout = setTimeout(() => {
      console.error('[GracefulShutdown] Timeout exceeded, forcing exit');
      process.exit(1);
    }, timeoutMs);

    for (const { name, handler } of this.shutdownHandlers) {
      try {
        await handler();
        console.log(`[GracefulShutdown] ${name}: done`);
      } catch (error) {
        console.error(`[GracefulShutdown] ${name}: failed`, error);
      }
    }

    clearTimeout(timeout);
  }

  /**
   * 安装信号处理
   */
  installSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    for (const signal of signals) {
      process.on(signal, () => {
        console.log(`[GracefulShutdown] Received ${signal}`);
        this.shutdown().then(() => process.exit(0));
      });
    }
  }

  isInShutdown(): boolean { return this.isShuttingDown; }
}

// ============================================================
// 预置配置
// ============================================================

export const DEFAULT_CIRCUIT_CONFIGS: Record<string, CircuitBreakerConfig> = {
  llm_api: { name: 'llm_api', failureThreshold: 5, successThreshold: 3, timeout: 30000, monitorWindow: 60000, volumeThreshold: 10, failureRateThreshold: 0.5 },
  database: { name: 'database', failureThreshold: 3, successThreshold: 2, timeout: 10000, monitorWindow: 30000, volumeThreshold: 5, failureRateThreshold: 0.3 },
  redis: { name: 'redis', failureThreshold: 3, successThreshold: 2, timeout: 5000, monitorWindow: 15000, volumeThreshold: 5, failureRateThreshold: 0.3 },
  external_api: { name: 'external_api', failureThreshold: 5, successThreshold: 3, timeout: 60000, monitorWindow: 120000, volumeThreshold: 10, failureRateThreshold: 0.5 },
};

export const DEFAULT_RATE_LIMITS: RateLimitConfig[] = [
  { dimension: 'ip', maxRequests: 100, windowMs: 60000 },
  { dimension: 'user', maxRequests: 60, windowMs: 60000 },
  { dimension: 'tenant', maxRequests: 1000, windowMs: 60000 },
  { dimension: 'api_key', maxRequests: 500, windowMs: 60000, penalty: { durationMs: 300000, threshold: 1000 } },
];

export const DEFAULT_SLOS: SLODefinition[] = [
  { id: 'availability', name: 'API Availability', type: 'availability', target: 0.999, window: 'rolling_30d', burnRateThreshold: 14.4 },
  { id: 'latency_p99', name: 'P99 Latency < 3s', type: 'latency', target: 0.99, window: 'rolling_7d', burnRateThreshold: 6 },
  { id: 'error_rate', name: 'Error Rate < 0.1%', type: 'error_rate', target: 0.999, window: 'rolling_7d', burnRateThreshold: 6 },
  { id: 'ai_success', name: 'AI Call Success > 95%', type: 'availability', target: 0.95, window: 'rolling_7d', burnRateThreshold: 3 },
];

// ============================================================
// 单例导出
// ============================================================

export const rateLimiter = new RateLimiter();
export const retryEngine = new RetryEngine();
export const deadLetterQueue = new DeadLetterQueue();
export const healthChecker = new HealthChecker();
export const sloMonitor = new SLOMonitor();
export const costGuardrail = new CostGuardrail();
export const chaosEngine = new ChaosEngine();
export const gracefulShutdown = new GracefulShutdown();

// 初始化默认限流规则
DEFAULT_RATE_LIMITS.forEach(config => rateLimiter.registerConfig(config));
// 初始化默认SLO
DEFAULT_SLOS.forEach(slo => sloMonitor.registerSLO(slo));
