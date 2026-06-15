/**
 * Phase 12 — Learning Flywheel: Feedback Engine + Implicit Signals + Label Engine
 * 
 * 模块一：显式反馈收集（Recruiter/Candidate ThumbUp/Down/Correction/ManualRanking）
 * 模块二：隐式信号采集（Click/Save/Interview/Offer/Hire/Retention/Performance/Reject）
 * 模块三：结果标签引擎（hire_label/performance_label/retention_label/promotion_label）
 */

import type {
  FeedbackEntry,
  FeedbackAggregation,
  FeedbackSource,
  FeedbackType,
  FeedbackTarget,
  ImplicitSignal,
  SignalType,
  OutcomeLabel,
  LabelType,
  LabelSource,
  LabelRule,
  SIGNAL_WEIGHTS,
  SIGNAL_DECAY_HALF_LIFE_DAYS,
} from './types';

// ============================================================
// 模块一：Feedback Engine
// ============================================================

export class FeedbackEngine {
  private entries: Map<string, FeedbackEntry> = new Map();
  private aggregationCache: Map<string, FeedbackAggregation> = new Map();

  /**
   * 提交反馈
   * 支持: ThumbUp/ThumbDown/Correction/ManualRanking/ManualScore
   */
  async submitFeedback(params: {
    tenantId: string;
    source: FeedbackSource;
    type: FeedbackType;
    target: FeedbackTarget;
    agentId: string;
    traceId: string;
    userId: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    rating?: number;
    reason?: string;
    correction?: string;
    manualRanking?: string[];
    manualScore?: Record<string, number>;
    sessionId?: string;
    candidateId?: string;
    jobId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<FeedbackEntry> {
    const entry: FeedbackEntry = {
      id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      tenantId: params.tenantId,
      source: params.source,
      type: params.type,
      target: params.target,
      agentId: params.agentId,
      traceId: params.traceId,
      userId: params.userId,
      sentiment: params.sentiment,
      rating: params.rating,
      reason: params.reason,
      correction: params.correction,
      manualRanking: params.manualRanking,
      manualScore: params.manualScore,
      sessionId: params.sessionId,
      candidateId: params.candidateId,
      jobId: params.jobId,
      timestamp: Date.now(),
      metadata: params.metadata,
    };

    this.entries.set(entry.id, entry);
    
    // 触发飞轮：反馈 → 数据集候选 → 标签更新
    await this.onFeedbackReceived(entry);
    
    // 清除聚合缓存
    this.invalidateAggregationCache(entry.agentId);

    return entry;
  }

  /**
   * 查询反馈
   */
  async queryFeedback(params: {
    tenantId: string;
    agentId?: string;
    source?: FeedbackSource;
    type?: FeedbackType;
    sentiment?: 'positive' | 'negative' | 'neutral';
    startTime?: number;
    endTime?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ entries: FeedbackEntry[]; total: number }> {
    let results = Array.from(this.entries.values())
      .filter(e => e.tenantId === params.tenantId);

    if (params.agentId) results = results.filter(e => e.agentId === params.agentId);
    if (params.source) results = results.filter(e => e.source === params.source);
    if (params.type) results = results.filter(e => e.type === params.type);
    if (params.sentiment) results = results.filter(e => e.sentiment === params.sentiment);
    if (params.startTime) results = results.filter(e => e.timestamp >= params.startTime!);
    if (params.endTime) results = results.filter(e => e.timestamp <= params.endTime!);

    results.sort((a, b) => b.timestamp - a.timestamp);
    const total = results.length;
    const limit = params.limit || 50;
    const offset = params.offset || 0;

    return {
      entries: results.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * 聚合反馈指标
   */
  async aggregateFeedback(params: {
    tenantId: string;
    agentId: string;
    period: 'hour' | 'day' | 'week' | 'month';
  }): Promise<FeedbackAggregation> {
    const cacheKey = `${params.tenantId}:${params.agentId}:${params.period}`;
    const cached = this.aggregationCache.get(cacheKey);
    if (cached) return cached;

    const now = Date.now();
    const periodMs = {
      hour: 3600_000,
      day: 86400_000,
      week: 604800_000,
      month: 2592000_000,
    }[params.period];

    const entries = Array.from(this.entries.values())
      .filter(e => 
        e.tenantId === params.tenantId &&
        e.agentId === params.agentId &&
        e.timestamp >= now - periodMs
      );

    const total = entries.length;
    const positive = entries.filter(e => e.sentiment === 'positive').length;
    const negative = entries.filter(e => e.sentiment === 'negative').length;
    const ratings = entries.filter(e => e.rating != null).map(e => e.rating!);
    const corrections = entries.filter(e => e.correction != null).length;

    // 统计原因
    const reasonCounts = new Map<string, number>();
    entries.forEach(e => {
      if (e.reason) {
        reasonCounts.set(e.reason, (reasonCounts.get(e.reason) || 0) + 1);
      }
    });
    const topReasons = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 趋势检测（对比前一个周期）
    const prevEntries = Array.from(this.entries.values())
      .filter(e =>
        e.tenantId === params.tenantId &&
        e.agentId === params.agentId &&
        e.timestamp >= now - periodMs * 2 &&
        e.timestamp < now - periodMs
      );
    const prevPositiveRate = prevEntries.length > 0
      ? prevEntries.filter(e => e.sentiment === 'positive').length / prevEntries.length
      : 0;
    const currentPositiveRate = total > 0 ? positive / total : 0;
    const trend = currentPositiveRate > prevPositiveRate + 0.05
      ? 'improving' as const
      : currentPositiveRate < prevPositiveRate - 0.05
        ? 'degrading' as const
        : 'stable' as const;

    const aggregation: FeedbackAggregation = {
      agentId: params.agentId,
      period: params.period,
      totalFeedback: total,
      positiveRate: total > 0 ? positive / total : 0,
      negativeRate: total > 0 ? negative / total : 0,
      averageRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
      topReasons,
      correctionRate: total > 0 ? corrections / total : 0,
      trend,
    };

    this.aggregationCache.set(cacheKey, aggregation);
    return aggregation;
  }

  /**
   * 导出反馈数据（用于Dataset Builder）
   */
  async exportForDataset(params: {
    tenantId: string;
    agentId: string;
    type: 'corrections' | 'negative' | 'positive' | 'all';
    minRating?: number;
    maxRating?: number;
  }): Promise<FeedbackEntry[]> {
    let results = Array.from(this.entries.values())
      .filter(e => e.tenantId === params.tenantId && e.agentId === params.agentId);

    switch (params.type) {
      case 'corrections':
        results = results.filter(e => e.correction != null);
        break;
      case 'negative':
        results = results.filter(e => e.sentiment === 'negative');
        break;
      case 'positive':
        results = results.filter(e => e.sentiment === 'positive');
        break;
    }

    if (params.minRating != null) results = results.filter(e => (e.rating || 0) >= params.minRating!);
    if (params.maxRating != null) results = results.filter(e => (e.rating || 5) <= params.maxRating!);

    return results;
  }

  private async onFeedbackReceived(entry: FeedbackEntry): Promise<void> {
    // 飞轮触发点：
    // 1. correction → 自动加入 failure dataset
    // 2. 连续负面反馈 → 触发 degradation alert
    // 3. manual_ranking → 更新 ranking golden dataset
    // 4. manual_score → 校准 scoring agent
    // 实际实现通过 EventBus 发布事件，由 ContinuousImprovementLoop 消费
  }

  private invalidateAggregationCache(agentId: string): void {
    for (const key of this.aggregationCache.keys()) {
      if (key.includes(agentId)) {
        this.aggregationCache.delete(key);
      }
    }
  }
}

// ============================================================
// 模块二：Implicit Signals Collector
// ============================================================

export class ImplicitSignalCollector {
  private signals: Map<string, ImplicitSignal> = new Map();
  private signalWeights: Record<SignalType, number> = {
    click: 0.05, save: 0.10, view_duration: 0.08,
    interview: 0.25, offer: 0.40, hire: 0.60,
    retention: 0.80, performance: 0.90, promotion: 1.00,
    reject: -0.30, skip: -0.10, compare: 0.03,
    share: 0.15, download: 0.12, contact: 0.20,
  };

  /**
   * 记录隐式信号
   */
  async recordSignal(params: {
    tenantId: string;
    signalType: SignalType;
    userId: string;
    userRole: 'recruiter' | 'hiring_manager' | 'candidate';
    entityType: 'candidate' | 'job' | 'recommendation' | 'agent_output';
    entityId: string;
    agentId?: string;
    traceId?: string;
    sourceScreen?: string;
    position?: number;
    value?: number;
    duration?: number;
    metadata?: Record<string, unknown>;
  }): Promise<ImplicitSignal> {
    const signal: ImplicitSignal = {
      id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      tenantId: params.tenantId,
      signalType: params.signalType,
      userId: params.userId,
      userRole: params.userRole,
      entityType: params.entityType,
      entityId: params.entityId,
      agentId: params.agentId,
      traceId: params.traceId,
      sourceScreen: params.sourceScreen,
      position: params.position,
      value: params.value ?? this.computeSignalValue(params.signalType, params.duration),
      duration: params.duration,
      timestamp: Date.now(),
      metadata: params.metadata,
    };

    this.signals.set(signal.id, signal);
    return signal;
  }

  /**
   * 聚合实体信号（计算综合质量分）
   */
  async aggregateEntitySignals(params: {
    tenantId: string;
    entityType: 'candidate' | 'job';
    entityId: string;
    timeWindow?: number; // ms, 默认90天
  }): Promise<{
    compositeScore: number;
    signalBreakdown: Record<SignalType, { count: number; weightedValue: number }>;
    totalSignals: number;
    latestSignalAt: number;
  }> {
    const timeWindow = params.timeWindow || 90 * 86400_000;
    const cutoff = Date.now() - timeWindow;

    const entitySignals = Array.from(this.signals.values())
      .filter(s =>
        s.tenantId === params.tenantId &&
        s.entityType === params.entityType &&
        s.entityId === params.entityId &&
        s.timestamp >= cutoff
      );

    const breakdown: Record<string, { count: number; weightedValue: number }> = {};
    let compositeScore = 0;

    for (const signal of entitySignals) {
      if (!breakdown[signal.signalType]) {
        breakdown[signal.signalType] = { count: 0, weightedValue: 0 };
      }
      breakdown[signal.signalType].count++;

      // 时间衰减
      const ageMs = Date.now() - signal.timestamp;
      const halfLifeMs = (this.getDecayHalfLife(signal.signalType)) * 86400_000;
      const decay = Math.pow(0.5, ageMs / halfLifeMs);

      // 位置偏差校正（列表越靠后点击价值越高）
      const positionBoost = signal.position ? Math.log2(signal.position + 1) / 10 : 0;

      const weight = this.signalWeights[signal.signalType];
      const weightedValue = (signal.value * weight * decay) + positionBoost;
      breakdown[signal.signalType].weightedValue += weightedValue;
      compositeScore += weightedValue;
    }

    // 归一化到 0-1
    compositeScore = Math.max(0, Math.min(1, (compositeScore + 1) / 2));

    return {
      compositeScore,
      signalBreakdown: breakdown as Record<SignalType, { count: number; weightedValue: number }>,
      totalSignals: entitySignals.length,
      latestSignalAt: entitySignals.length > 0
        ? Math.max(...entitySignals.map(s => s.timestamp))
        : 0,
    };
  }

  /**
   * 获取用户行为序列（用于行为分析）
   */
  async getUserBehaviorSequence(params: {
    tenantId: string;
    userId: string;
    limit?: number;
  }): Promise<ImplicitSignal[]> {
    return Array.from(this.signals.values())
      .filter(s => s.tenantId === params.tenantId && s.userId === params.userId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, params.limit || 100);
  }

  /**
   * 批量导出信号（用于Label Engine）
   */
  async exportSignalsForEntity(params: {
    tenantId: string;
    entityType: 'candidate' | 'job';
    entityId: string;
    signalTypes?: SignalType[];
  }): Promise<ImplicitSignal[]> {
    let results = Array.from(this.signals.values())
      .filter(s =>
        s.tenantId === params.tenantId &&
        s.entityType === params.entityType &&
        s.entityId === params.entityId
      );

    if (params.signalTypes) {
      results = results.filter(s => params.signalTypes!.includes(s.signalType));
    }

    return results.sort((a, b) => a.timestamp - b.timestamp);
  }

  private computeSignalValue(signalType: SignalType, duration?: number): number {
    // 基础值
    const baseValues: Partial<Record<SignalType, number>> = {
      click: 0.3,
      save: 0.7,
      interview: 0.8,
      offer: 0.9,
      hire: 1.0,
      retention: 1.0,
      performance: 0.9,
      promotion: 1.0,
      reject: 0.2,
      skip: 0.1,
      compare: 0.4,
      share: 0.6,
      download: 0.5,
      contact: 0.7,
    };

    if (signalType === 'view_duration' && duration) {
      // 查看时长归一化：30s以上为高价值
      return Math.min(1, duration / 30000);
    }

    return baseValues[signalType] || 0.5;
  }

  private getDecayHalfLife(signalType: SignalType): number {
    const halfLifeDays: Record<SignalType, number> = {
      click: 7, save: 30, view_duration: 7,
      interview: 60, offer: 90, hire: 180,
      retention: 365, performance: 365, promotion: 365,
      reject: 30, skip: 14, compare: 7,
      share: 30, download: 14, contact: 30,
    };
    return halfLifeDays[signalType];
  }
}

// ============================================================
// 模块三：Label Engine
// ============================================================

export class LabelEngine {
  private labels: Map<string, OutcomeLabel> = new Map();
  private signalCollector: ImplicitSignalCollector;
  
  // 标签生成规则
  private rules: LabelRule[] = [
    {
      labelType: 'hire_label',
      triggerSignals: ['hire'],
      observationWindow: 7,   // 录用后7天确认
      minConfidence: 0.9,
      valueMapping: (signals) => {
        const hireSignal = signals.find(s => s.signalType === 'hire');
        return hireSignal ? 1.0 : 0.0;
      },
    },
    {
      labelType: 'performance_label',
      triggerSignals: ['performance'],
      observationWindow: 90,  // 入职90天后评估
      minConfidence: 0.7,
      valueMapping: (signals) => {
        const perfSignals = signals.filter(s => s.signalType === 'performance');
        if (perfSignals.length === 0) return 0.5;
        return perfSignals.reduce((sum, s) => sum + s.value, 0) / perfSignals.length;
      },
    },
    {
      labelType: 'retention_label',
      triggerSignals: ['retention'],
      observationWindow: 180, // 入职180天后评估
      minConfidence: 0.8,
      valueMapping: (signals) => {
        const retentionSignals = signals.filter(s => s.signalType === 'retention');
        return retentionSignals.length > 0 ? 1.0 : 0.0;
      },
    },
    {
      labelType: 'promotion_label',
      triggerSignals: ['promotion'],
      observationWindow: 365, // 入职365天后评估
      minConfidence: 0.85,
      valueMapping: (signals) => {
        const promoSignals = signals.filter(s => s.signalType === 'promotion');
        return promoSignals.length > 0 ? 1.0 : 0.0;
      },
    },
  ];

  constructor(signalCollector: ImplicitSignalCollector) {
    this.signalCollector = signalCollector;
  }

  /**
   * 自动生成标签（基于隐式信号 + 时间窗口）
   */
  async generateLabels(params: {
    tenantId: string;
    candidateId: string;
    jobId: string;
    agentId?: string;
    traceId?: string;
  }): Promise<OutcomeLabel[]> {
    const generatedLabels: OutcomeLabel[] = [];

    for (const rule of this.rules) {
      // 获取相关信号
      const signals = await this.signalCollector.exportSignalsForEntity({
        tenantId: params.tenantId,
        entityType: 'candidate',
        entityId: params.candidateId,
        signalTypes: rule.triggerSignals,
      });

      if (signals.length === 0) continue;

      // 检查观察窗口
      const latestSignal = signals[signals.length - 1];
      const windowStart = latestSignal.timestamp - rule.observationWindow * 86400_000;
      const windowSignals = signals.filter(s => s.timestamp >= windowStart);

      if (windowSignals.length === 0) continue;

      // 计算标签值
      const value = rule.valueMapping(windowSignals);
      const confidence = this.computeConfidence(windowSignals, rule);

      if (confidence < rule.minConfidence) continue;

      const label: OutcomeLabel = {
        id: `lbl_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        tenantId: params.tenantId,
        labelType: rule.labelType,
        candidateId: params.candidateId,
        jobId: params.jobId,
        agentId: params.agentId,
        traceId: params.traceId,
        value,
        confidence,
        source: 'system_auto',
        observationStart: windowStart,
        observationEnd: latestSignal.timestamp,
        labeledAt: Date.now(),
        evidenceSignals: windowSignals.map(s => s.id),
      };

      this.labels.set(label.id, label);
      generatedLabels.push(label);
    }

    return generatedLabels;
  }

  /**
   * 人工验证标签
   */
  async verifyLabel(params: {
    labelId: string;
    verifiedBy: string;
    correctedValue?: number;
    reason?: string;
  }): Promise<OutcomeLabel | null> {
    const label = this.labels.get(params.labelId);
    if (!label) return null;

    const updated: OutcomeLabel = {
      ...label,
      source: 'human_verified',
      value: params.correctedValue ?? label.value,
      confidence: 1.0, // 人工验证置信度为1
      metadata: {
        ...label.metadata,
        verifiedBy: params.verifiedBy,
        verifiedAt: Date.now(),
        originalValue: label.value,
        correctionReason: params.reason,
      },
    };

    this.labels.set(updated.id, updated);
    return updated;
  }

  /**
   * 查询标签
   */
  async queryLabels(params: {
    tenantId: string;
    labelType?: LabelType;
    candidateId?: string;
    jobId?: string;
    minConfidence?: number;
    source?: LabelSource;
  }): Promise<OutcomeLabel[]> {
    let results = Array.from(this.labels.values())
      .filter(l => l.tenantId === params.tenantId);

    if (params.labelType) results = results.filter(l => l.labelType === params.labelType);
    if (params.candidateId) results = results.filter(l => l.candidateId === params.candidateId);
    if (params.jobId) results = results.filter(l => l.jobId === params.jobId);
    if (params.minConfidence) results = results.filter(l => l.confidence >= params.minConfidence!);
    if (params.source) results = results.filter(l => l.source === params.source);

    return results.sort((a, b) => b.labeledAt - a.labeledAt);
  }

  /**
   * 计算Agent推荐质量（基于标签反馈）
   */
  async computeAgentQuality(params: {
    tenantId: string;
    agentId: string;
    labelType: LabelType;
    timeWindow?: number;
  }): Promise<{
    totalLabeled: number;
    averageValue: number;
    distribution: Record<string, number>; // 分桶分布
    trend: 'improving' | 'stable' | 'degrading';
  }> {
    const timeWindow = params.timeWindow || 90 * 86400_000;
    const cutoff = Date.now() - timeWindow;

    const agentLabels = Array.from(this.labels.values())
      .filter(l =>
        l.tenantId === params.tenantId &&
        l.agentId === params.agentId &&
        l.labelType === params.labelType &&
        l.labeledAt >= cutoff
      );

    const totalLabeled = agentLabels.length;
    const averageValue = totalLabeled > 0
      ? agentLabels.reduce((sum, l) => sum + l.value, 0) / totalLabeled
      : 0;

    // 分桶分布
    const distribution: Record<string, number> = {
      'excellent (0.8-1.0)': 0,
      'good (0.6-0.8)': 0,
      'average (0.4-0.6)': 0,
      'below_average (0.2-0.4)': 0,
      'poor (0.0-0.2)': 0,
    };
    agentLabels.forEach(l => {
      if (l.value >= 0.8) distribution['excellent (0.8-1.0)']++;
      else if (l.value >= 0.6) distribution['good (0.6-0.8)']++;
      else if (l.value >= 0.4) distribution['average (0.4-0.6)']++;
      else if (l.value >= 0.2) distribution['below_average (0.2-0.4)']++;
      else distribution['poor (0.0-0.2)']++;
    });

    // 趋势（前半 vs 后半）
    const midpoint = cutoff + timeWindow / 2;
    const firstHalf = agentLabels.filter(l => l.labeledAt < midpoint);
    const secondHalf = agentLabels.filter(l => l.labeledAt >= midpoint);
    const firstAvg = firstHalf.length > 0
      ? firstHalf.reduce((s, l) => s + l.value, 0) / firstHalf.length : 0;
    const secondAvg = secondHalf.length > 0
      ? secondHalf.reduce((s, l) => s + l.value, 0) / secondHalf.length : 0;
    const trend = secondAvg > firstAvg + 0.05 ? 'improving' as const
      : secondAvg < firstAvg - 0.05 ? 'degrading' as const
      : 'stable' as const;

    return { totalLabeled, averageValue, distribution, trend };
  }

  private computeConfidence(signals: ImplicitSignal[], rule: LabelRule): number {
    // 置信度基于：信号数量 + 信号一致性 + 时间跨度
    const countFactor = Math.min(1, signals.length / 3); // 3个以上信号满分
    
    // 一致性：所有信号方向是否一致
    const values = signals.map(s => s.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const consistencyFactor = Math.max(0, 1 - Math.sqrt(variance));

    // 时间跨度：越长越可靠
    const timeSpan = signals.length > 1
      ? signals[signals.length - 1].timestamp - signals[0].timestamp
      : 0;
    const timeFactor = Math.min(1, timeSpan / (rule.observationWindow * 86400_000));

    return countFactor * 0.4 + consistencyFactor * 0.4 + timeFactor * 0.2;
  }
}

// ============================================================
// 单例导出
// ============================================================

export const feedbackEngine = new FeedbackEngine();
export const signalCollector = new ImplicitSignalCollector();
export const labelEngine = new LabelEngine(signalCollector);
