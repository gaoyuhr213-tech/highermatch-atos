/**
 * Phase 12 — Learning Flywheel: Experiment Platform (A/B Testing)
 * 
 * 模块六：A/B Testing平台
 * - Traffic Split（流量分配）
 * - Variant Assignment（变体分配）
 * - Metrics Collection（指标采集）
 * - Statistical Analysis（统计分析）
 * - Winner Selection（胜出判定）
 * 
 * 对标: Statsig / LaunchDarkly / Optimizely / LangSmith Experiments
 */

import type {
  Experiment,
  ExperimentVariant,
  ExperimentAssignment,
  ExperimentStatus,
  TrafficSplitStrategy,
} from './types';

// ============================================================
// Experiment Platform
// ============================================================

export class ExperimentPlatform {
  private experiments: Map<string, Experiment> = new Map();
  private assignments: Map<string, ExperimentAssignment> = new Map(); // userId → assignment
  private metricEvents: Array<{
    experimentId: string;
    variantId: string;
    metricName: string;
    value: number;
    timestamp: number;
  }> = [];

  /**
   * 创建实验
   */
  async createExperiment(params: {
    tenantId: string;
    name: string;
    description: string;
    agentId: string;
    hypothesis: string;
    primaryMetric: string;
    secondaryMetrics?: string[];
    variants: Array<{
      name: string;
      promptVersion: string;
      trafficPercentage: number;
    }>;
    trafficSplit?: TrafficSplitStrategy;
    minSampleSize?: number;
    significanceLevel?: number;
    minDetectableEffect?: number;
    createdBy: string;
  }): Promise<Experiment> {
    // 验证流量分配总和 = 100
    const totalTraffic = params.variants.reduce((sum, v) => sum + v.trafficPercentage, 0);
    if (Math.abs(totalTraffic - 100) > 0.01) {
      throw new Error(`Traffic percentages must sum to 100, got ${totalTraffic}`);
    }

    const experimentId = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const variants: ExperimentVariant[] = params.variants.map((v, i) => ({
      id: `var_${experimentId}_${i}`,
      experimentId,
      name: v.name,
      promptVersion: v.promptVersion,
      trafficPercentage: v.trafficPercentage,
      sampleSize: 0,
      metrics: {},
      isWinner: false,
    }));

    const experiment: Experiment = {
      id: experimentId,
      tenantId: params.tenantId,
      name: params.name,
      description: params.description,
      agentId: params.agentId,
      hypothesis: params.hypothesis,
      primaryMetric: params.primaryMetric,
      secondaryMetrics: params.secondaryMetrics || [],
      variants,
      trafficSplit: params.trafficSplit || 'user_hash',
      minSampleSize: params.minSampleSize || 100,
      significanceLevel: params.significanceLevel || 0.05,
      minDetectableEffect: params.minDetectableEffect || 0.05,
      status: 'draft',
      createdAt: Date.now(),
      createdBy: params.createdBy,
    };

    this.experiments.set(experiment.id, experiment);
    return experiment;
  }

  /**
   * 启动实验
   */
  async startExperiment(experimentId: string): Promise<Experiment> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) throw new Error(`Experiment ${experimentId} not found`);
    if (experiment.status !== 'draft' && experiment.status !== 'paused') {
      throw new Error(`Cannot start experiment in ${experiment.status} status`);
    }

    experiment.status = 'running';
    experiment.startedAt = Date.now();
    return experiment;
  }

  /**
   * 分配用户到变体
   * 基于 Traffic Split Strategy 确定性分配
   */
  async assignVariant(params: {
    experimentId: string;
    userId: string;
    tenantId?: string;
  }): Promise<ExperimentVariant | null> {
    const experiment = this.experiments.get(params.experimentId);
    if (!experiment || experiment.status !== 'running') return null;

    // 检查是否已分配
    const assignmentKey = `${params.experimentId}:${params.userId}`;
    const existing = this.assignments.get(assignmentKey);
    if (existing) {
      return experiment.variants.find(v => v.id === existing.variantId) || null;
    }

    // 确定性分配（基于hash）
    const variant = this.selectVariant(experiment, params.userId);
    if (!variant) return null;

    // 记录分配
    const assignment: ExperimentAssignment = {
      experimentId: params.experimentId,
      variantId: variant.id,
      userId: params.userId,
      assignedAt: Date.now(),
    };
    this.assignments.set(assignmentKey, assignment);
    variant.sampleSize++;

    return variant;
  }

  /**
   * 记录实验指标
   */
  async recordMetric(params: {
    experimentId: string;
    userId: string;
    metricName: string;
    value: number;
  }): Promise<void> {
    const assignmentKey = `${params.experimentId}:${params.userId}`;
    const assignment = this.assignments.get(assignmentKey);
    if (!assignment) return;

    this.metricEvents.push({
      experimentId: params.experimentId,
      variantId: assignment.variantId,
      metricName: params.metricName,
      value: params.value,
      timestamp: Date.now(),
    });

    // 更新变体指标
    const experiment = this.experiments.get(params.experimentId);
    if (!experiment) return;
    
    const variant = experiment.variants.find(v => v.id === assignment.variantId);
    if (!variant) return;

    // 增量更新均值
    const currentCount = variant.metrics[`${params.metricName}_count`] || 0;
    const currentSum = (variant.metrics[params.metricName] || 0) * currentCount;
    const newCount = currentCount + 1;
    variant.metrics[params.metricName] = (currentSum + params.value) / newCount;
    variant.metrics[`${params.metricName}_count`] = newCount;
  }

  /**
   * 分析实验结果
   */
  async analyzeExperiment(experimentId: string): Promise<{
    experiment: Experiment;
    analysis: {
      isSignificant: boolean;
      winner: ExperimentVariant | null;
      pValue: number;
      confidenceInterval: [number, number];
      effectSize: number;
      powerAnalysis: {
        currentPower: number;
        requiredSampleSize: number;
        estimatedDaysRemaining: number;
      };
      variantComparison: Array<{
        variantId: string;
        variantName: string;
        primaryMetricValue: number;
        sampleSize: number;
        relativeImprovement: number; // vs control
        pValue: number;
        isSignificant: boolean;
      }>;
    };
  }> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) throw new Error(`Experiment ${experimentId} not found`);

    const control = experiment.variants.find(v => v.name === 'control') || experiment.variants[0];
    const primaryMetric = experiment.primaryMetric;

    // 统计分析
    const variantComparison = experiment.variants.map(variant => {
      const metricValue = variant.metrics[primaryMetric] || 0;
      const controlValue = control.metrics[primaryMetric] || 0;
      const relativeImprovement = controlValue > 0
        ? (metricValue - controlValue) / controlValue
        : 0;

      // 简化的Z-test（实际生产应使用更严格的统计方法）
      const pValue = this.computePValue(
        variant.metrics[primaryMetric] || 0,
        control.metrics[primaryMetric] || 0,
        variant.sampleSize,
        control.sampleSize
      );

      return {
        variantId: variant.id,
        variantName: variant.name,
        primaryMetricValue: metricValue,
        sampleSize: variant.sampleSize,
        relativeImprovement,
        pValue,
        isSignificant: pValue < experiment.significanceLevel,
      };
    });

    // 找到胜出者
    const significantVariants = variantComparison
      .filter(v => v.isSignificant && v.relativeImprovement > 0)
      .sort((a, b) => b.relativeImprovement - a.relativeImprovement);

    const winner = significantVariants.length > 0
      ? experiment.variants.find(v => v.id === significantVariants[0].variantId) || null
      : null;

    // 效果量（Cohen's d 简化版）
    const bestImprovement = significantVariants.length > 0
      ? significantVariants[0].relativeImprovement : 0;
    const effectSize = Math.abs(bestImprovement);

    // 整体显著性
    const overallPValue = variantComparison.length > 1
      ? Math.min(...variantComparison.filter(v => v.variantId !== control.id).map(v => v.pValue))
      : 1;
    const isSignificant = overallPValue < experiment.significanceLevel;

    // Power分析
    const totalSamples = experiment.variants.reduce((sum, v) => sum + v.sampleSize, 0);
    const dailyRate = totalSamples / Math.max(1, (Date.now() - (experiment.startedAt || Date.now())) / 86400_000);
    const requiredSampleSize = experiment.minSampleSize * experiment.variants.length;
    const currentPower = Math.min(1, totalSamples / requiredSampleSize);
    const remainingSamples = Math.max(0, requiredSampleSize - totalSamples);
    const estimatedDaysRemaining = dailyRate > 0 ? remainingSamples / dailyRate : Infinity;

    return {
      experiment,
      analysis: {
        isSignificant,
        winner,
        pValue: overallPValue,
        confidenceInterval: [
          bestImprovement - 1.96 * Math.sqrt(bestImprovement * (1 - bestImprovement) / Math.max(1, totalSamples)),
          bestImprovement + 1.96 * Math.sqrt(bestImprovement * (1 - bestImprovement) / Math.max(1, totalSamples)),
        ],
        effectSize,
        powerAnalysis: {
          currentPower,
          requiredSampleSize,
          estimatedDaysRemaining,
        },
        variantComparison,
      },
    };
  }

  /**
   * 结束实验并选择胜出者
   */
  async concludeExperiment(experimentId: string, params?: {
    winnerId?: string; // 手动指定胜出者
    reason?: string;
  }): Promise<Experiment> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) throw new Error(`Experiment ${experimentId} not found`);

    experiment.status = 'completed';
    experiment.endedAt = Date.now();

    if (params?.winnerId) {
      experiment.winnerId = params.winnerId;
      const winner = experiment.variants.find(v => v.id === params.winnerId);
      if (winner) winner.isWinner = true;
    } else {
      // 自动判定
      const analysis = await this.analyzeExperiment(experimentId);
      if (analysis.analysis.winner) {
        experiment.winnerId = analysis.analysis.winner.id;
        analysis.analysis.winner.isWinner = true;
      }
    }

    return experiment;
  }

  /**
   * 获取活跃实验
   */
  async getActiveExperiments(params?: {
    tenantId?: string;
    agentId?: string;
  }): Promise<Experiment[]> {
    let results = Array.from(this.experiments.values())
      .filter(e => e.status === 'running');

    if (params?.tenantId) results = results.filter(e => e.tenantId === params.tenantId);
    if (params?.agentId) results = results.filter(e => e.agentId === params.agentId);

    return results;
  }

  /**
   * 获取实验历史
   */
  async getExperimentHistory(params: {
    tenantId: string;
    agentId?: string;
    status?: ExperimentStatus;
    limit?: number;
  }): Promise<Experiment[]> {
    let results = Array.from(this.experiments.values())
      .filter(e => e.tenantId === params.tenantId);

    if (params.agentId) results = results.filter(e => e.agentId === params.agentId);
    if (params.status) results = results.filter(e => e.status === params.status);

    return results
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, params.limit || 50);
  }

  /**
   * 暂停实验
   */
  async pauseExperiment(experimentId: string): Promise<Experiment> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) throw new Error(`Experiment ${experimentId} not found`);
    experiment.status = 'paused';
    return experiment;
  }

  // ============================================================
  // 内部方法
  // ============================================================

  private selectVariant(experiment: Experiment, userId: string): ExperimentVariant | null {
    switch (experiment.trafficSplit) {
      case 'user_hash': {
        // 确定性hash分配（同一用户始终分到同一变体）
        const hash = this.hashString(`${experiment.id}:${userId}`);
        const bucket = hash % 100;
        
        let cumulative = 0;
        for (const variant of experiment.variants) {
          cumulative += variant.trafficPercentage;
          if (bucket < cumulative) return variant;
        }
        return experiment.variants[experiment.variants.length - 1];
      }

      case 'random': {
        const rand = Math.random() * 100;
        let cumulative = 0;
        for (const variant of experiment.variants) {
          cumulative += variant.trafficPercentage;
          if (rand < cumulative) return variant;
        }
        return experiment.variants[experiment.variants.length - 1];
      }

      case 'round_robin': {
        const totalAssigned = experiment.variants.reduce((sum, v) => sum + v.sampleSize, 0);
        const targetIdx = totalAssigned % experiment.variants.length;
        return experiment.variants[targetIdx];
      }

      case 'tenant_hash': {
        // 租户级分配（同一租户所有用户看到同一变体）
        const tenantHash = this.hashString(`${experiment.id}:${experiment.tenantId}`);
        const bucket = tenantHash % 100;
        let cumulative = 0;
        for (const variant of experiment.variants) {
          cumulative += variant.trafficPercentage;
          if (bucket < cumulative) return variant;
        }
        return experiment.variants[experiment.variants.length - 1];
      }

      default:
        return experiment.variants[0];
    }
  }

  private computePValue(
    treatmentMean: number,
    controlMean: number,
    treatmentN: number,
    controlN: number
  ): number {
    if (treatmentN < 2 || controlN < 2) return 1;

    // 简化的双样本Z-test（假设方差相等）
    const pooledVariance = 0.25; // 保守估计（二项分布最大方差）
    const se = Math.sqrt(pooledVariance * (1 / treatmentN + 1 / controlN));
    
    if (se === 0) return 1;
    
    const z = Math.abs(treatmentMean - controlMean) / se;
    
    // 标准正态分布CDF近似（Abramowitz and Stegun）
    const pValue = 2 * (1 - this.normalCDF(z));
    return Math.max(0, Math.min(1, pValue));
  }

  private normalCDF(x: number): number {
    // Abramowitz and Stegun approximation
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// ============================================================
// 单例导出
// ============================================================

export const experimentPlatform = new ExperimentPlatform();
