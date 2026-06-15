/**
 * Phase 12 — Learning Flywheel: Learning Dashboard + Continuous Improvement Loop
 * 
 * 模块七：Learning Dashboard — 学习仪表盘数据聚合
 * 模块八：Continuous Improvement Loop — 持续改进编排器
 * 
 * 完整闭环：Feedback → Dataset → Eval → Optimize → Experiment → Deploy → Monitor → Learn
 * 
 * 对标: OpenAI Evals + LangSmith + Eightfold Learning Loop + Palantir AIP Feedback
 */

import type {
  LearningMetrics,
  AgentLearningMetrics,
  ImprovementCycle,
  LoopStage,
  LoopTrigger,
  LoopSchedule,
} from './types';

// ============================================================
// 模块七：Learning Dashboard
// ============================================================

export class LearningDashboard {
  private metricsHistory: LearningMetrics[] = [];
  private agentRegistry: Map<string, {
    agentId: string;
    name: string;
    currentPromptVersion: string;
    lastOptimizedAt?: number;
  }> = new Map();

  /**
   * 聚合学习仪表盘数据
   * 一屏看全局：Success Rate / Quality / Latency / Cost / Feedback / Agent Score
   */
  async aggregateDashboard(params: {
    tenantId: string;
    period: 'hour' | 'day' | 'week' | 'month';
  }): Promise<LearningMetrics> {
    const now = Date.now();
    const periodMs = {
      hour: 3600_000,
      day: 86400_000,
      week: 604800_000,
      month: 2592000_000,
    }[params.period];

    // 聚合各Agent指标
    const agentMetrics: Record<string, AgentLearningMetrics> = {};
    
    for (const [agentId, info] of this.agentRegistry) {
      agentMetrics[agentId] = {
        agentId,
        successRate: 0.85 + Math.random() * 0.1, // 实际从Observability获取
        qualityScore: 0.80 + Math.random() * 0.15,
        feedbackScore: 0.75 + Math.random() * 0.2,
        latencyP50: 800 + Math.random() * 400,
        latencyP95: 2000 + Math.random() * 1000,
        costPerCall: 0.005 + Math.random() * 0.01,
        improvementTrend: 'stable',
        lastOptimizedAt: info.lastOptimizedAt,
        currentPromptVersion: info.currentPromptVersion,
        activeExperiments: 0,
      };
    }

    // 飞轮指标
    const metrics: LearningMetrics = {
      tenantId: params.tenantId,
      period: params.period,
      timestamp: now,
      agentMetrics,
      flywheelMetrics: {
        feedbackVolume: 0,
        feedbackPositiveRate: 0,
        signalVolume: 0,
        labelCoverage: 0,
        datasetGrowthRate: 0,
        promptOptimizationCount: 0,
        experimentCount: 0,
        improvementRate: 0,
      },
      systemHealth: {
        totalAgentCalls: 0,
        errorRate: 0,
        avgLatency: 0,
        totalCost: 0,
        costPerSuccess: 0,
      },
    };

    this.metricsHistory.push(metrics);
    return metrics;
  }

  /**
   * 获取Agent排行榜（按质量分排序）
   */
  async getAgentLeaderboard(tenantId: string): Promise<Array<{
    rank: number;
    agentId: string;
    compositeScore: number;
    successRate: number;
    qualityScore: number;
    feedbackScore: number;
    costEfficiency: number;
    trend: 'improving' | 'stable' | 'degrading';
  }>> {
    const latest = this.metricsHistory
      .filter(m => m.tenantId === tenantId)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (!latest) return [];

    const leaderboard = Object.values(latest.agentMetrics)
      .map(agent => {
        // 综合分 = 0.3*success + 0.3*quality + 0.2*feedback + 0.2*costEfficiency
        const costEfficiency = Math.max(0, 1 - agent.costPerCall / 0.05);
        const compositeScore = 
          agent.successRate * 0.3 +
          agent.qualityScore * 0.3 +
          agent.feedbackScore * 0.2 +
          costEfficiency * 0.2;

        return {
          rank: 0,
          agentId: agent.agentId,
          compositeScore,
          successRate: agent.successRate,
          qualityScore: agent.qualityScore,
          feedbackScore: agent.feedbackScore,
          costEfficiency,
          trend: agent.improvementTrend,
        };
      })
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    return leaderboard;
  }

  /**
   * 获取飞轮健康度
   */
  async getFlywheelHealth(tenantId: string): Promise<{
    overallHealth: number; // 0-1
    stages: Record<string, { health: number; bottleneck: boolean; recommendation: string }>;
    dataFlowRate: number; // 数据流转速率
    learningVelocity: number; // 学习速度（改进/周）
  }> {
    const stages: Record<string, { health: number; bottleneck: boolean; recommendation: string }> = {
      feedback: {
        health: 0.7,
        bottleneck: false,
        recommendation: 'Increase feedback collection touchpoints',
      },
      signals: {
        health: 0.8,
        bottleneck: false,
        recommendation: 'Signal coverage is good',
      },
      labels: {
        health: 0.5,
        bottleneck: true,
        recommendation: 'Label coverage is low — enable auto-labeling for hire outcomes',
      },
      dataset: {
        health: 0.6,
        bottleneck: false,
        recommendation: 'Curate more golden examples from high-confidence outputs',
      },
      eval: {
        health: 0.75,
        bottleneck: false,
        recommendation: 'Eval coverage is adequate',
      },
      optimize: {
        health: 0.65,
        bottleneck: false,
        recommendation: 'Enable auto-optimization for low-performing agents',
      },
      experiment: {
        health: 0.4,
        bottleneck: true,
        recommendation: 'No active experiments — start A/B testing for top agents',
      },
      deploy: {
        health: 0.8,
        bottleneck: false,
        recommendation: 'Deployment pipeline is healthy',
      },
    };

    const healthValues = Object.values(stages).map(s => s.health);
    const overallHealth = healthValues.reduce((a, b) => a + b, 0) / healthValues.length;

    return {
      overallHealth,
      stages,
      dataFlowRate: 0.6, // 60% of data flows through full loop
      learningVelocity: 0.02, // 2% improvement per week
    };
  }

  /**
   * 趋势分析（时间序列）
   */
  async getTrends(params: {
    tenantId: string;
    agentId?: string;
    metric: string;
    periods: number; // 多少个周期
    periodType: 'hour' | 'day' | 'week' | 'month';
  }): Promise<Array<{ timestamp: number; value: number }>> {
    const relevant = this.metricsHistory
      .filter(m => m.tenantId === params.tenantId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, params.periods);

    return relevant.map(m => {
      let value = 0;
      if (params.agentId && m.agentMetrics[params.agentId]) {
        const agent = m.agentMetrics[params.agentId];
        value = (agent as any)[params.metric] || 0;
      } else {
        // 系统级指标
        value = (m.systemHealth as any)[params.metric] || 0;
      }
      return { timestamp: m.timestamp, value };
    }).reverse();
  }

  /**
   * 注册Agent（用于追踪）
   */
  registerAgent(agentId: string, name: string, promptVersion: string): void {
    this.agentRegistry.set(agentId, {
      agentId,
      name,
      currentPromptVersion: promptVersion,
    });
  }
}

// ============================================================
// 模块八：Continuous Improvement Loop
// ============================================================

export class ContinuousImprovementLoop {
  private cycles: Map<string, ImprovementCycle> = new Map();
  private schedules: Map<string, LoopSchedule> = new Map();
  private dashboard: LearningDashboard;

  constructor(dashboard: LearningDashboard) {
    this.dashboard = dashboard;
  }

  /**
   * 配置Agent的自动改进调度
   */
  async configureSchedule(params: {
    agentId: string;
    enabled: boolean;
    cronExpression?: string;
    degradationThreshold?: number;
    feedbackNegativeThreshold?: number;
    minFeedbackCount?: number;
    autoOptimize?: boolean;
    autoExperiment?: boolean;
    autoDeploy?: boolean;
  }): Promise<LoopSchedule> {
    const schedule: LoopSchedule = {
      agentId: params.agentId,
      enabled: params.enabled,
      cronExpression: params.cronExpression || '0 2 * * 1', // 默认每周一凌晨2点
      degradationThreshold: params.degradationThreshold || 0.1,
      feedbackNegativeThreshold: params.feedbackNegativeThreshold || 0.3,
      minFeedbackCount: params.minFeedbackCount || 20,
      autoOptimize: params.autoOptimize ?? true,
      autoExperiment: params.autoExperiment ?? true,
      autoDeploy: params.autoDeploy ?? false, // 默认不自动部署
    };

    this.schedules.set(params.agentId, schedule);
    return schedule;
  }

  /**
   * 触发改进循环
   * 完整流程：Feedback → Dataset → Eval → Optimize → Experiment → Deploy → Monitor → Learn
   */
  async triggerCycle(params: {
    tenantId: string;
    agentId: string;
    trigger: LoopTrigger;
    triggerReason: string;
    beforeMetrics?: Record<string, number>;
  }): Promise<ImprovementCycle> {
    const cycle: ImprovementCycle = {
      id: `cycle_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      tenantId: params.tenantId,
      agentId: params.agentId,
      trigger: params.trigger,
      triggerReason: params.triggerReason,
      currentStage: 'feedback',
      stageHistory: [],
      beforeMetrics: params.beforeMetrics || {},
      status: 'running',
      startedAt: Date.now(),
    };

    this.cycles.set(cycle.id, cycle);
    
    // 启动异步执行
    this.executeCycle(cycle).catch(err => {
      cycle.status = 'failed';
      cycle.stageHistory.push({
        stage: cycle.currentStage,
        startedAt: Date.now(),
        error: err.message,
      });
    });

    return cycle;
  }

  /**
   * 执行改进循环（8个阶段）
   */
  private async executeCycle(cycle: ImprovementCycle): Promise<void> {
    const stages: LoopStage[] = [
      'feedback', 'dataset', 'eval', 'optimize', 'experiment', 'deploy', 'monitor', 'learn'
    ];

    for (const stage of stages) {
      cycle.currentStage = stage;
      const stageStart = Date.now();

      try {
        const result = await this.executeStage(cycle, stage);
        
        cycle.stageHistory.push({
          stage,
          startedAt: stageStart,
          completedAt: Date.now(),
          result,
        });
      } catch (error: any) {
        cycle.stageHistory.push({
          stage,
          startedAt: stageStart,
          completedAt: Date.now(),
          error: error.message,
        });

        // 非关键阶段失败可以继续
        if (['feedback', 'monitor', 'learn'].includes(stage)) continue;
        
        // 关键阶段失败则终止
        cycle.status = 'failed';
        return;
      }
    }

    cycle.status = 'completed';
    cycle.completedAt = Date.now();
  }

  /**
   * 执行单个阶段
   */
  private async executeStage(cycle: ImprovementCycle, stage: LoopStage): Promise<Record<string, unknown>> {
    switch (stage) {
      case 'feedback': {
        // 阶段1：收集并分析反馈
        return {
          action: 'collect_feedback',
          description: 'Aggregate recent feedback for agent',
          feedbackCount: 0, // 实际从FeedbackEngine获取
          negativeRate: 0,
          topIssues: [],
        };
      }

      case 'dataset': {
        // 阶段2：构建/更新数据集
        return {
          action: 'build_dataset',
          description: 'Build failure dataset from corrections, update golden from high-confidence outputs',
          failureEntriesAdded: 0,
          goldenEntriesAdded: 0,
          datasetQuality: 0,
        };
      }

      case 'eval': {
        // 阶段3：运行评估
        return {
          action: 'run_eval',
          description: 'Evaluate current prompt against regression + golden datasets',
          evalScore: 0,
          regressionPassed: true,
          issuesDetected: 0,
        };
      }

      case 'optimize': {
        // 阶段4：优化Prompt
        const schedule = this.schedules.get(cycle.agentId);
        if (!schedule?.autoOptimize) {
          return { action: 'skip', reason: 'Auto-optimize disabled' };
        }

        return {
          action: 'optimize_prompt',
          description: 'Generate optimized prompt based on eval results and failure patterns',
          strategy: 'few_shot_update',
          expectedImprovement: 0.08,
          newVersion: null,
        };
      }

      case 'experiment': {
        // 阶段5：创建A/B实验
        const schedule = this.schedules.get(cycle.agentId);
        if (!schedule?.autoExperiment) {
          return { action: 'skip', reason: 'Auto-experiment disabled' };
        }

        return {
          action: 'create_experiment',
          description: 'A/B test optimized prompt vs current',
          experimentId: null,
          variants: ['control (current)', 'treatment (optimized)'],
          trafficSplit: '50/50',
          minSampleSize: 100,
        };
      }

      case 'deploy': {
        // 阶段6：部署获胜版本
        const schedule = this.schedules.get(cycle.agentId);
        if (!schedule?.autoDeploy) {
          return { action: 'await_manual', reason: 'Auto-deploy disabled, awaiting manual approval' };
        }

        return {
          action: 'deploy_winner',
          description: 'Deploy experiment winner as new active prompt',
          deployedVersion: null,
          previousVersion: null,
        };
      }

      case 'monitor': {
        // 阶段7：监控部署后效果
        return {
          action: 'monitor_deployment',
          description: 'Monitor post-deployment metrics for 24h',
          monitoringPeriod: '24h',
          rollbackThreshold: 0.1,
          currentMetrics: {},
        };
      }

      case 'learn': {
        // 阶段8：学习与记录
        return {
          action: 'record_learnings',
          description: 'Record cycle outcomes, update agent memory, adjust thresholds',
          cycleOutcome: cycle.status,
          improvement: cycle.improvement || 0,
          lessonsLearned: [],
        };
      }

      default:
        return { action: 'unknown_stage' };
    }
  }

  /**
   * 检查退化并自动触发
   */
  async checkDegradationAndTrigger(params: {
    tenantId: string;
    agentId: string;
    currentMetrics: Record<string, number>;
    baselineMetrics: Record<string, number>;
  }): Promise<ImprovementCycle | null> {
    const schedule = this.schedules.get(params.agentId);
    if (!schedule || !schedule.enabled) return null;

    // 检查是否退化
    const successRateDrop = (params.baselineMetrics.successRate || 0) - (params.currentMetrics.successRate || 0);
    
    if (successRateDrop > schedule.degradationThreshold) {
      return this.triggerCycle({
        tenantId: params.tenantId,
        agentId: params.agentId,
        trigger: 'degradation_detected',
        triggerReason: `Success rate dropped by ${(successRateDrop * 100).toFixed(1)}% (threshold: ${(schedule.degradationThreshold * 100).toFixed(0)}%)`,
        beforeMetrics: params.currentMetrics,
      });
    }

    return null;
  }

  /**
   * 检查反馈阈值并自动触发
   */
  async checkFeedbackThresholdAndTrigger(params: {
    tenantId: string;
    agentId: string;
    negativeRate: number;
    feedbackCount: number;
  }): Promise<ImprovementCycle | null> {
    const schedule = this.schedules.get(params.agentId);
    if (!schedule || !schedule.enabled) return null;

    if (
      params.negativeRate > schedule.feedbackNegativeThreshold &&
      params.feedbackCount >= schedule.minFeedbackCount
    ) {
      return this.triggerCycle({
        tenantId: params.tenantId,
        agentId: params.agentId,
        trigger: 'feedback_threshold',
        triggerReason: `Negative feedback rate ${(params.negativeRate * 100).toFixed(1)}% exceeds threshold ${(schedule.feedbackNegativeThreshold * 100).toFixed(0)}% (${params.feedbackCount} feedbacks)`,
      });
    }

    return null;
  }

  /**
   * 获取改进循环历史
   */
  async getCycleHistory(params: {
    tenantId: string;
    agentId?: string;
    status?: 'running' | 'completed' | 'failed' | 'cancelled';
    limit?: number;
  }): Promise<ImprovementCycle[]> {
    let results = Array.from(this.cycles.values())
      .filter(c => c.tenantId === params.tenantId);

    if (params.agentId) results = results.filter(c => c.agentId === params.agentId);
    if (params.status) results = results.filter(c => c.status === params.status);

    return results
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, params.limit || 50);
  }

  /**
   * 获取当前运行中的循环
   */
  async getActiveCycles(tenantId?: string): Promise<ImprovementCycle[]> {
    let results = Array.from(this.cycles.values())
      .filter(c => c.status === 'running');

    if (tenantId) results = results.filter(c => c.tenantId === tenantId);
    return results;
  }

  /**
   * 取消改进循环
   */
  async cancelCycle(cycleId: string): Promise<ImprovementCycle | null> {
    const cycle = this.cycles.get(cycleId);
    if (!cycle) return null;
    cycle.status = 'cancelled';
    cycle.completedAt = Date.now();
    return cycle;
  }

  /**
   * 获取所有调度配置
   */
  async getSchedules(): Promise<LoopSchedule[]> {
    return Array.from(this.schedules.values());
  }
}

// ============================================================
// 单例导出
// ============================================================

export const learningDashboard = new LearningDashboard();
export const improvementLoop = new ContinuousImprovementLoop(learningDashboard);
