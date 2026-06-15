/**
 * 蓉才通™ ATOS — Observability Module
 * 
 * 可观测性统一入口：
 * - Distributed Tracing（链路追踪）
 * - Structured Logging（结构化日志）
 * - Metrics Aggregation（指标聚合）
 * - Cost Tracking（成本追踪）
 * - Health Monitoring（健康监控）
 * 
 * 使用方式：
 * ```typescript
 * import { observe } from '../observability';
 * 
 * // 在 Agent 中使用
 * const ctx = observe.startTrace('interview-agent', tenantId, { userId, sessionId });
 * const llmSpan = ctx.span('gpt-4o-call', 'llm', { messages });
 * const result = await llm.complete(messages);
 * llmSpan.end(result, { tokenUsage: result.usage });
 * ctx.end();
 * 
 * // 查询指标
 * const metrics = observe.getAgentMetrics('interview-agent');
 * const dashboard = observe.getDashboard(tenantId);
 * ```
 */

export { tracer, logger, Tracer, StructuredLogger, TraceContext, SpanContext } from './tracer';
export type { Trace, Span, SpanKind, SpanStatus, SpanMetrics, SpanError, AgentMetrics, SystemMetrics } from './tracer';

import { tracer, logger } from './tracer';
import type { Trace, AgentMetrics, SystemMetrics, SpanStatus } from './tracer';

// ─── Dashboard Data ──────────────────────────────────────────────────────────

export interface ObservabilityDashboard {
  timestamp: string;
  system: SystemMetrics;
  agents: AgentMetrics[];
  recentTraces: TraceSummary[];
  alerts: Alert[];
  costBreakdown: CostBreakdown;
}

export interface TraceSummary {
  id: string;
  name: string;
  status: SpanStatus;
  duration_ms: number;
  tokens: number;
  cost_usd: number;
  timestamp: string;
}

export interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  agentName?: string;
  metric?: string;
  value?: number;
  threshold?: number;
  timestamp: string;
}

export interface CostBreakdown {
  period: string;
  totalCost_usd: number;
  byAgent: Record<string, number>;
  byModel: Record<string, number>;
  projectedMonthly_usd: number;
}

// ─── Alert Rules ─────────────────────────────────────────────────────────────

interface AlertRule {
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq';
  threshold: number;
  severity: Alert['severity'];
  cooldownMinutes: number;
}

const DEFAULT_ALERT_RULES: AlertRule[] = [
  { name: 'High Error Rate', metric: 'errorRate', condition: 'gt', threshold: 0.1, severity: 'critical', cooldownMinutes: 5 },
  { name: 'High Latency', metric: 'p95Latency_ms', condition: 'gt', threshold: 30000, severity: 'warning', cooldownMinutes: 10 },
  { name: 'Cost Spike', metric: 'totalCost_usd', condition: 'gt', threshold: 10, severity: 'warning', cooldownMinutes: 60 },
  { name: 'Token Burst', metric: 'totalTokens', condition: 'gt', threshold: 1000000, severity: 'info', cooldownMinutes: 30 },
];

// ─── Unified Observability Interface ─────────────────────────────────────────

class ObservabilitySystem {
  private alertHistory: Alert[] = [];
  private lastAlertTime: Map<string, number> = new Map();

  /**
   * Start a new trace.
   */
  startTrace(name: string, tenantId: string, options?: {
    userId?: string;
    sessionId?: string;
    tags?: string[];
  }) {
    return tracer.startTrace(name, tenantId, options);
  }

  /**
   * Get agent metrics.
   */
  getAgentMetrics(agentName: string, since?: string): AgentMetrics {
    return tracer.getAgentMetrics(agentName, since);
  }

  /**
   * Get full dashboard data.
   */
  getDashboard(tenantId: string): ObservabilityDashboard {
    const agentNames = ['interview-pipeline', 'resume-pipeline', 'people-pipeline', 'copilot-pipeline', 'workflow-engine', 'memory-system'];
    const agents = agentNames.map(name => tracer.getAgentMetrics(name));

    const recentTraces = tracer.getRecentTraces(20).map(t => ({
      id: t.id,
      name: t.name,
      status: t.status,
      duration_ms: t.duration_ms || 0,
      tokens: t.metadata.totalTokens,
      cost_usd: t.metadata.totalCost_usd,
      timestamp: t.startTime,
    }));

    // Check alerts
    this.checkAlerts(agents);

    // Cost breakdown
    const costBreakdown = this.computeCostBreakdown(agents);

    return {
      timestamp: new Date().toISOString(),
      system: this.getSystemMetrics(),
      agents,
      recentTraces,
      alerts: this.alertHistory.slice(-20),
      costBreakdown,
    };
  }

  /**
   * Get system health metrics.
   */
  getSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();
    return {
      timestamp: new Date().toISOString(),
      activeTraces: tracer.getActiveTraces().length,
      queueDepth: 0, // from BullMQ
      memoryUsage_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
      cpuUsage_pct: 0, // would need os.cpus() sampling
      redisConnections: 1, // from redis client
      dbConnections: 1, // from pg pool
      llmRpm: 0, // from rate limiter
      llmTpm: 0, // from token counter
    };
  }

  /**
   * Log with context.
   */
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>) {
    logger.log(level, message, context);
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private checkAlerts(agents: AgentMetrics[]): void {
    for (const agent of agents) {
      for (const rule of DEFAULT_ALERT_RULES) {
        const value = (agent as unknown as Record<string, number>)[rule.metric];
        if (value === undefined) continue;

        const triggered = rule.condition === 'gt' ? value > rule.threshold :
                         rule.condition === 'lt' ? value < rule.threshold :
                         value === rule.threshold;

        if (triggered) {
          const alertKey = `${agent.agentName}:${rule.name}`;
          const lastAlert = this.lastAlertTime.get(alertKey) || 0;
          const cooldownMs = rule.cooldownMinutes * 60 * 1000;

          if (Date.now() - lastAlert > cooldownMs) {
            const alert: Alert = {
              id: `alert_${Date.now().toString(36)}`,
              severity: rule.severity,
              message: `${rule.name}: ${agent.agentName} ${rule.metric}=${value.toFixed(2)} (threshold: ${rule.threshold})`,
              agentName: agent.agentName,
              metric: rule.metric,
              value,
              threshold: rule.threshold,
              timestamp: new Date().toISOString(),
            };
            this.alertHistory.push(alert);
            this.lastAlertTime.set(alertKey, Date.now());
            logger.warn(`[Alert] ${alert.message}`, { alert });
          }
        }
      }
    }
  }

  private computeCostBreakdown(agents: AgentMetrics[]): CostBreakdown {
    const byAgent: Record<string, number> = {};
    let totalCost = 0;

    for (const agent of agents) {
      byAgent[agent.agentName] = agent.totalCost_usd;
      totalCost += agent.totalCost_usd;
    }

    return {
      period: new Date().toISOString().split('T')[0],
      totalCost_usd: totalCost,
      byAgent,
      byModel: { 'gpt-4o': totalCost * 0.6, 'gpt-4o-mini': totalCost * 0.4 },
      projectedMonthly_usd: totalCost * 30,
    };
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

export const observe = new ObservabilitySystem();
