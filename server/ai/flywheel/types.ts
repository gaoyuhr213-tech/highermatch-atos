/**
 * Phase 12 — Learning Flywheel: Core Type Definitions
 * 
 * 对标: OpenAI Evals + LangSmith + Eightfold Learning Loop
 * 
 * 数据飞轮完整类型系统：
 * Feedback → Signals → Labels → Dataset → Eval → Optimize → Experiment → Deploy → Monitor → Learn
 */

// ============================================================
// 模块一：Feedback Engine — 显式反馈
// ============================================================

export type FeedbackSource = 'recruiter' | 'candidate' | 'interviewer' | 'system' | 'admin';
export type FeedbackType = 'thumb_up' | 'thumb_down' | 'correction' | 'manual_ranking' | 'manual_score' | 'comment' | 'flag';
export type FeedbackTarget = 'agent_output' | 'recommendation' | 'ranking' | 'score' | 'email' | 'question' | 'report' | 'match';

export interface FeedbackEntry {
  id: string;
  tenantId: string;
  source: FeedbackSource;
  type: FeedbackType;
  target: FeedbackTarget;
  
  // 关联上下文
  agentId: string;           // 哪个Agent产出
  traceId: string;           // 关联Observability trace
  sessionId?: string;        // 关联会话
  candidateId?: string;      // 关联候选人
  jobId?: string;            // 关联岗位
  
  // 反馈内容
  sentiment: 'positive' | 'negative' | 'neutral';
  rating?: number;           // 1-5 评分
  reason?: string;           // 反馈原因（自由文本）
  correction?: string;       // 修正内容（用户认为正确的答案）
  manualRanking?: string[];  // 手动排序（候选人ID列表）
  manualScore?: Record<string, number>; // 手动评分（维度 → 分数）
  
  // 元数据
  userId: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface FeedbackAggregation {
  agentId: string;
  period: 'hour' | 'day' | 'week' | 'month';
  totalFeedback: number;
  positiveRate: number;      // 0-1
  negativeRate: number;      // 0-1
  averageRating: number;     // 1-5
  topReasons: Array<{ reason: string; count: number }>;
  correctionRate: number;    // 被修正的比例
  trend: 'improving' | 'stable' | 'degrading';
}

// ============================================================
// 模块二：Implicit Signals — 隐式信号
// ============================================================

export type SignalType = 
  | 'click'           // 点击候选人/岗位
  | 'save'            // 收藏/保存
  | 'view_duration'   // 查看时长
  | 'interview'       // 进入面试
  | 'offer'           // 发出Offer
  | 'hire'            // 录用
  | 'retention'       // 留存（3/6/12月）
  | 'performance'     // 绩效评级
  | 'promotion'       // 晋升
  | 'reject'          // 拒绝
  | 'skip'            // 跳过
  | 'compare'         // 对比查看
  | 'share'           // 分享
  | 'download'        // 下载简历
  | 'contact';        // 主动联系

export interface ImplicitSignal {
  id: string;
  tenantId: string;
  signalType: SignalType;
  
  // 主体
  userId: string;
  userRole: 'recruiter' | 'hiring_manager' | 'candidate';
  
  // 客体
  entityType: 'candidate' | 'job' | 'recommendation' | 'agent_output';
  entityId: string;
  
  // 上下文
  agentId?: string;          // 触发此行为的Agent推荐
  traceId?: string;          // 关联trace
  sourceScreen?: string;     // 来源页面
  position?: number;         // 在列表中的位置（用于位置偏差校正）
  
  // 信号值
  value: number;             // 信号强度（0-1 归一化）
  duration?: number;         // 持续时间（ms，用于view_duration）
  
  // 时间
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// 信号权重矩阵（用于计算综合质量分）
export const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  click: 0.05,
  save: 0.10,
  view_duration: 0.08,
  interview: 0.25,
  offer: 0.40,
  hire: 0.60,
  retention: 0.80,
  performance: 0.90,
  promotion: 1.00,
  reject: -0.30,
  skip: -0.10,
  compare: 0.03,
  share: 0.15,
  download: 0.12,
  contact: 0.20,
};

// 信号时间衰减系数
export const SIGNAL_DECAY_HALF_LIFE_DAYS: Record<SignalType, number> = {
  click: 7,
  save: 30,
  view_duration: 7,
  interview: 60,
  offer: 90,
  hire: 180,
  retention: 365,
  performance: 365,
  promotion: 365,
  reject: 30,
  skip: 14,
  compare: 7,
  share: 30,
  download: 14,
  contact: 30,
};

// ============================================================
// 模块三：Label Engine — 结果标签
// ============================================================

export type LabelType = 'hire_label' | 'performance_label' | 'retention_label' | 'promotion_label';
export type LabelSource = 'system_auto' | 'human_verified' | 'inferred' | 'imported';

export interface OutcomeLabel {
  id: string;
  tenantId: string;
  labelType: LabelType;
  
  // 关联实体
  candidateId: string;
  jobId: string;
  agentId?: string;          // 产出推荐的Agent
  traceId?: string;          // 原始推荐的trace
  
  // 标签值
  value: number;             // 0-1 归一化（0=最差, 1=最好）
  rawValue?: string;         // 原始值（如 "A+", "promoted", "3-month-retained"）
  confidence: number;        // 0-1 标签置信度
  source: LabelSource;
  
  // 时间窗口
  observationStart: number;  // 观察开始时间
  observationEnd: number;    // 观察结束时间
  labeledAt: number;         // 标签生成时间
  
  // 追溯
  evidenceSignals: string[]; // 支撑此标签的隐式信号ID列表
  metadata?: Record<string, unknown>;
}

// 标签生成规则
export interface LabelRule {
  labelType: LabelType;
  triggerSignals: SignalType[];     // 触发信号类型
  observationWindow: number;        // 观察窗口（天）
  minConfidence: number;            // 最低置信度
  valueMapping: (signals: ImplicitSignal[]) => number; // 信号 → 标签值映射
}

// ============================================================
// 模块四：Dataset Builder — 数据集构建
// ============================================================

export type DatasetType = 'golden' | 'regression' | 'failure' | 'replay' | 'synthetic';
export type DatasetStatus = 'building' | 'ready' | 'archived' | 'deprecated';

export interface Dataset {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  type: DatasetType;
  status: DatasetStatus;
  
  // 关联Agent
  agentId: string;
  promptVersion: string;     // 关联的Prompt版本
  
  // 统计
  entryCount: number;
  qualityScore: number;      // 0-1 数据集质量分
  coverageScore: number;     // 0-1 覆盖度
  diversityScore: number;    // 0-1 多样性
  
  // 时间
  createdAt: number;
  updatedAt: number;
  lastEvalAt?: number;
  
  metadata?: Record<string, unknown>;
}

export interface DatasetEntry {
  id: string;
  datasetId: string;
  
  // 输入
  input: Record<string, unknown>;    // Agent输入
  context?: Record<string, unknown>; // 上下文
  
  // 期望输出
  expectedOutput: Record<string, unknown>;
  
  // 实际输出（如果来自回放）
  actualOutput?: Record<string, unknown>;
  
  // 质量标注
  quality: 'verified' | 'unverified' | 'disputed';
  labeledBy?: string;        // 标注者
  
  // 来源追溯
  sourceType: 'feedback_correction' | 'human_labeled' | 'high_confidence_auto' | 'failure_case' | 'replay';
  sourceId?: string;         // 来源ID（feedback/trace/signal）
  
  // 元数据
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  createdAt: number;
}

// ============================================================
// 模块五：Prompt Optimizer — Prompt优化
// ============================================================

export type PromptIssueType = 'error' | 'degradation' | 'high_cost' | 'low_success' | 'hallucination' | 'bias';
export type OptimizationStrategy = 'rewrite' | 'few_shot_update' | 'constraint_add' | 'simplify' | 'decompose';

export interface PromptVersion {
  id: string;
  agentId: string;
  version: string;           // semver: 1.0.0, 1.0.1, 1.1.0
  
  // Prompt内容
  systemPrompt: string;
  userPromptTemplate: string;
  fewShotExamples?: Array<{ input: string; output: string }>;
  
  // 性能指标
  metrics: {
    successRate: number;     // 0-1
    avgLatency: number;      // ms
    avgCost: number;         // USD
    avgQuality: number;      // 0-1 (from Eval)
    feedbackScore: number;   // 0-1 (from Feedback)
    hallucinationRate: number; // 0-1
  };
  
  // 版本管理
  parentVersion?: string;    // 父版本
  changeReason: string;      // 变更原因
  changeType: 'manual' | 'auto_optimized' | 'ab_winner' | 'rollback';
  
  // 状态
  status: 'draft' | 'testing' | 'active' | 'deprecated' | 'rolled_back';
  deployedAt?: number;
  deprecatedAt?: number;
  
  createdAt: number;
  createdBy: string;
}

export interface PromptIssue {
  id: string;
  agentId: string;
  promptVersion: string;
  issueType: PromptIssueType;
  
  // 问题描述
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  
  // 证据
  evidenceTraceIds: string[];      // 问题trace
  evidenceFeedbackIds: string[];   // 相关反馈
  sampleCount: number;             // 样本数
  failureRate: number;             // 失败率
  
  // 建议
  suggestedStrategy: OptimizationStrategy;
  suggestedFix?: string;           // 建议的修改
  
  // 状态
  status: 'detected' | 'confirmed' | 'fixing' | 'fixed' | 'wont_fix';
  detectedAt: number;
  resolvedAt?: number;
}

// ============================================================
// 模块六：Experiment Platform — A/B Testing
// ============================================================

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
export type TrafficSplitStrategy = 'random' | 'user_hash' | 'tenant_hash' | 'round_robin';

export interface Experiment {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  
  // 实验配置
  agentId: string;
  hypothesis: string;        // 假设
  primaryMetric: string;     // 主要指标
  secondaryMetrics: string[];// 次要指标
  
  // 变体
  variants: ExperimentVariant[];
  trafficSplit: TrafficSplitStrategy;
  
  // 统计配置
  minSampleSize: number;     // 最小样本量
  significanceLevel: number; // 显著性水平（默认0.05）
  minDetectableEffect: number; // 最小可检测效果（MDE）
  
  // 状态
  status: ExperimentStatus;
  startedAt?: number;
  endedAt?: number;
  winnerId?: string;         // 获胜变体ID
  
  createdAt: number;
  createdBy: string;
}

export interface ExperimentVariant {
  id: string;
  experimentId: string;
  name: string;              // e.g., "control", "variant_a", "variant_b"
  
  // 配置
  promptVersion: string;     // 使用的Prompt版本
  trafficPercentage: number; // 流量百分比（0-100）
  
  // 结果
  sampleSize: number;
  metrics: Record<string, number>;  // 指标名 → 值
  
  // 统计
  isWinner: boolean;
  pValue?: number;
  confidenceInterval?: [number, number];
  effectSize?: number;
}

export interface ExperimentAssignment {
  experimentId: string;
  variantId: string;
  userId: string;
  assignedAt: number;
}

// ============================================================
// 模块七：Learning Dashboard — 学习仪表盘
// ============================================================

export interface LearningMetrics {
  tenantId: string;
  period: 'hour' | 'day' | 'week' | 'month';
  timestamp: number;
  
  // Agent质量
  agentMetrics: Record<string, AgentLearningMetrics>;
  
  // 飞轮指标
  flywheelMetrics: {
    feedbackVolume: number;          // 反馈量
    feedbackPositiveRate: number;    // 正面反馈率
    signalVolume: number;            // 信号量
    labelCoverage: number;           // 标签覆盖率
    datasetGrowthRate: number;       // 数据集增长率
    promptOptimizationCount: number; // Prompt优化次数
    experimentCount: number;         // 实验数
    improvementRate: number;         // 改进率（本周vs上周）
  };
  
  // 系统健康
  systemHealth: {
    totalAgentCalls: number;
    errorRate: number;
    avgLatency: number;
    totalCost: number;
    costPerSuccess: number;
  };
}

export interface AgentLearningMetrics {
  agentId: string;
  successRate: number;       // 0-1
  qualityScore: number;      // 0-1 (Eval)
  feedbackScore: number;     // 0-1 (User feedback)
  latencyP50: number;        // ms
  latencyP95: number;        // ms
  costPerCall: number;       // USD
  improvementTrend: 'improving' | 'stable' | 'degrading';
  lastOptimizedAt?: number;
  currentPromptVersion: string;
  activeExperiments: number;
}

// ============================================================
// 模块八：Continuous Improvement Loop — 持续改进循环
// ============================================================

export type LoopStage = 'feedback' | 'dataset' | 'eval' | 'optimize' | 'experiment' | 'deploy' | 'monitor' | 'learn';
export type LoopTrigger = 'scheduled' | 'degradation_detected' | 'feedback_threshold' | 'manual' | 'experiment_complete';

export interface ImprovementCycle {
  id: string;
  tenantId: string;
  agentId: string;
  
  // 触发
  trigger: LoopTrigger;
  triggerReason: string;
  
  // 阶段进度
  currentStage: LoopStage;
  stageHistory: Array<{
    stage: LoopStage;
    startedAt: number;
    completedAt?: number;
    result?: Record<string, unknown>;
    error?: string;
  }>;
  
  // 改进结果
  beforeMetrics: Record<string, number>;
  afterMetrics?: Record<string, number>;
  improvement?: number;      // 改进幅度（百分比）
  
  // 关联
  datasetId?: string;
  evalRunId?: string;
  experimentId?: string;
  newPromptVersion?: string;
  
  // 状态
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: number;
  completedAt?: number;
}

export interface LoopSchedule {
  agentId: string;
  enabled: boolean;
  
  // 定时触发
  cronExpression?: string;   // e.g., "0 2 * * 1" (每周一凌晨2点)
  
  // 条件触发
  degradationThreshold: number;    // 质量下降多少触发（0-1）
  feedbackNegativeThreshold: number; // 负面反馈率超过多少触发
  minFeedbackCount: number;        // 最少反馈数才触发
  
  // 自动化级别
  autoOptimize: boolean;     // 自动优化Prompt
  autoExperiment: boolean;   // 自动创建A/B实验
  autoDeploy: boolean;       // 自动部署获胜版本
  
  lastRunAt?: number;
  nextRunAt?: number;
}
