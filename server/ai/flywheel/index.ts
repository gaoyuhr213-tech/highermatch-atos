/**
 * Phase 12 — Learning Flywheel: 统一入口
 * 
 * 完整数据飞轮系统：
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    LEARNING FLYWHEEL                         │
 * │                                                             │
 * │  ┌──────────┐    ┌──────────┐    ┌──────────┐             │
 * │  │ Feedback │───▶│ Signals  │───▶│  Labels  │             │
 * │  │  Engine  │    │Collector │    │  Engine  │             │
 * │  └──────────┘    └──────────┘    └──────────┘             │
 * │       │                                │                    │
 * │       ▼                                ▼                    │
 * │  ┌──────────┐    ┌──────────┐    ┌──────────┐             │
 * │  │ Dataset  │───▶│  Prompt  │───▶│Experiment│             │
 * │  │ Builder  │    │Optimizer │    │ Platform │             │
 * │  └──────────┘    └──────────┘    └──────────┘             │
 * │       │                                │                    │
 * │       ▼                                ▼                    │
 * │  ┌──────────┐    ┌──────────────────────────┐             │
 * │  │ Learning │◀───│ Continuous Improvement    │             │
 * │  │Dashboard │    │        Loop              │             │
 * │  └──────────┘    └──────────────────────────┘             │
 * └─────────────────────────────────────────────────────────────┘
 * 
 * 对标: OpenAI Evals + LangSmith + Eightfold Learning Loop + Palantir AIP
 */

// ============================================================
// 模块导出
// ============================================================

export { feedbackEngine, signalCollector, labelEngine } from './feedback';
export { datasetBuilder, promptOptimizer } from './dataset';
export { experimentPlatform } from './experiment';
export { learningDashboard, improvementLoop } from './loop';

// 类型导出
export type {
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
  Dataset,
  DatasetEntry,
  DatasetType,
  PromptVersion,
  PromptIssue,
  PromptIssueType,
  OptimizationStrategy,
  Experiment,
  ExperimentVariant,
  ExperimentAssignment,
  ExperimentStatus,
  TrafficSplitStrategy,
  LearningMetrics,
  AgentLearningMetrics,
  ImprovementCycle,
  LoopStage,
  LoopTrigger,
  LoopSchedule,
} from './types';

// ============================================================
// DB Schema 定义（Drizzle ORM）
// ============================================================

/**
 * 数据库表设计：
 * 
 * 1. feedback_entries — 显式反馈
 *    - id, tenant_id, source, type, target
 *    - agent_id, trace_id, session_id, candidate_id, job_id
 *    - sentiment, rating, reason, correction
 *    - manual_ranking (jsonb), manual_score (jsonb)
 *    - user_id, timestamp, metadata (jsonb)
 *    - INDEX: (tenant_id, agent_id, timestamp)
 *    - INDEX: (tenant_id, sentiment, timestamp)
 * 
 * 2. implicit_signals — 隐式信号
 *    - id, tenant_id, signal_type
 *    - user_id, user_role, entity_type, entity_id
 *    - agent_id, trace_id, source_screen, position
 *    - value, duration, timestamp, metadata (jsonb)
 *    - INDEX: (tenant_id, entity_type, entity_id, timestamp)
 *    - INDEX: (tenant_id, user_id, timestamp)
 *    - INDEX: (tenant_id, signal_type, timestamp)
 * 
 * 3. outcome_labels — 结果标签
 *    - id, tenant_id, label_type
 *    - candidate_id, job_id, agent_id, trace_id
 *    - value, raw_value, confidence, source
 *    - observation_start, observation_end, labeled_at
 *    - evidence_signals (jsonb), metadata (jsonb)
 *    - INDEX: (tenant_id, label_type, candidate_id)
 *    - INDEX: (tenant_id, agent_id, label_type)
 * 
 * 4. datasets — 数据集
 *    - id, tenant_id, name, description, type, status
 *    - agent_id, prompt_version
 *    - entry_count, quality_score, coverage_score, diversity_score
 *    - created_at, updated_at, last_eval_at, metadata (jsonb)
 *    - INDEX: (tenant_id, agent_id, type)
 * 
 * 5. dataset_entries — 数据集条目
 *    - id, dataset_id
 *    - input (jsonb), context (jsonb), expected_output (jsonb), actual_output (jsonb)
 *    - quality, labeled_by, source_type, source_id
 *    - difficulty, tags (text[]), created_at
 *    - INDEX: (dataset_id, quality)
 *    - INDEX: (dataset_id, source_type)
 * 
 * 6. prompt_versions — Prompt版本
 *    - id, agent_id, version
 *    - system_prompt, user_prompt_template, few_shot_examples (jsonb)
 *    - metrics (jsonb), parent_version, change_reason, change_type
 *    - status, deployed_at, deprecated_at, created_at, created_by
 *    - INDEX: (agent_id, status)
 *    - INDEX: (agent_id, version)
 * 
 * 7. prompt_issues — Prompt问题
 *    - id, agent_id, prompt_version, issue_type
 *    - description, severity
 *    - evidence_trace_ids (text[]), evidence_feedback_ids (text[])
 *    - sample_count, failure_rate
 *    - suggested_strategy, suggested_fix
 *    - status, detected_at, resolved_at
 *    - INDEX: (agent_id, status, severity)
 * 
 * 8. experiments — A/B实验
 *    - id, tenant_id, name, description
 *    - agent_id, hypothesis, primary_metric, secondary_metrics (text[])
 *    - variants (jsonb), traffic_split
 *    - min_sample_size, significance_level, min_detectable_effect
 *    - status, started_at, ended_at, winner_id
 *    - created_at, created_by
 *    - INDEX: (tenant_id, status)
 *    - INDEX: (agent_id, status)
 * 
 * 9. experiment_assignments — 实验分配
 *    - experiment_id, variant_id, user_id, assigned_at
 *    - UNIQUE: (experiment_id, user_id)
 *    - INDEX: (experiment_id, variant_id)
 * 
 * 10. improvement_cycles — 改进循环
 *     - id, tenant_id, agent_id
 *     - trigger, trigger_reason
 *     - current_stage, stage_history (jsonb)
 *     - before_metrics (jsonb), after_metrics (jsonb), improvement
 *     - dataset_id, eval_run_id, experiment_id, new_prompt_version
 *     - status, started_at, completed_at
 *     - INDEX: (tenant_id, agent_id, status)
 *     - INDEX: (tenant_id, status, started_at)
 * 
 * 11. learning_metrics — 学习指标时序
 *     - id, tenant_id, period, timestamp
 *     - agent_metrics (jsonb), flywheel_metrics (jsonb), system_health (jsonb)
 *     - INDEX: (tenant_id, period, timestamp)
 */

// ============================================================
// Redis Key 设计
// ============================================================

/**
 * Redis Key Namespace:
 * 
 * flywheel:{tenantId}:feedback:recent:{agentId}     — 最近反馈（List, TTL 7d）
 * flywheel:{tenantId}:feedback:agg:{agentId}:{period} — 反馈聚合缓存（Hash, TTL 1h）
 * flywheel:{tenantId}:signals:stream:{entityId}     — 信号流（Stream, TTL 90d）
 * flywheel:{tenantId}:signals:score:{entityId}      — 实体综合分（String, TTL 1d）
 * flywheel:{tenantId}:labels:latest:{candidateId}   — 最新标签（Hash, TTL 365d）
 * flywheel:{tenantId}:experiment:active             — 活跃实验列表（Set）
 * flywheel:{tenantId}:experiment:assign:{expId}:{userId} — 实验分配（String, TTL=实验期）
 * flywheel:{tenantId}:experiment:metrics:{expId}:{variantId} — 变体指标（Hash）
 * flywheel:{tenantId}:loop:active:{agentId}         — 活跃循环（String, TTL 24h）
 * flywheel:{tenantId}:loop:schedule:{agentId}       — 调度配置（Hash）
 * flywheel:{tenantId}:dashboard:cache:{period}      — Dashboard缓存（JSON String, TTL 5min）
 * flywheel:{tenantId}:prompt:current:{agentId}      — 当前活跃Prompt版本（String）
 * flywheel:{tenantId}:prompt:metrics:{versionId}    — 版本指标（Hash, TTL 30d）
 */

// ============================================================
// API 路由定义
// ============================================================

/**
 * API Endpoints:
 * 
 * === Feedback ===
 * POST   /api/v2/flywheel/feedback              — 提交反馈
 * GET    /api/v2/flywheel/feedback               — 查询反馈
 * GET    /api/v2/flywheel/feedback/aggregate     — 聚合反馈指标
 * GET    /api/v2/flywheel/feedback/export        — 导出反馈数据
 * 
 * === Signals ===
 * POST   /api/v2/flywheel/signals                — 记录隐式信号
 * GET    /api/v2/flywheel/signals/entity/:id     — 获取实体信号聚合
 * GET    /api/v2/flywheel/signals/user/:id       — 获取用户行为序列
 * 
 * === Labels ===
 * POST   /api/v2/flywheel/labels/generate        — 自动生成标签
 * POST   /api/v2/flywheel/labels/verify          — 人工验证标签
 * GET    /api/v2/flywheel/labels                  — 查询标签
 * GET    /api/v2/flywheel/labels/quality/:agentId — Agent推荐质量
 * 
 * === Dataset ===
 * POST   /api/v2/flywheel/dataset                — 创建数据集
 * POST   /api/v2/flywheel/dataset/build/golden   — 构建Golden Dataset
 * POST   /api/v2/flywheel/dataset/build/failure  — 构建Failure Dataset
 * POST   /api/v2/flywheel/dataset/build/regression — 构建Regression Dataset
 * POST   /api/v2/flywheel/dataset/curate/:id     — 策展数据集
 * GET    /api/v2/flywheel/dataset/:id/entries     — 获取数据集条目
 * 
 * === Prompt ===
 * POST   /api/v2/flywheel/prompt/version         — 注册Prompt版本
 * GET    /api/v2/flywheel/prompt/versions/:agentId — 获取版本历史
 * GET    /api/v2/flywheel/prompt/issues           — 获取活跃问题
 * POST   /api/v2/flywheel/prompt/detect-issues    — 检测问题
 * POST   /api/v2/flywheel/prompt/optimize         — 自动优化
 * POST   /api/v2/flywheel/prompt/rollback/:id     — 回滚版本
 * GET    /api/v2/flywheel/prompt/diff             — 版本对比
 * 
 * === Experiment ===
 * POST   /api/v2/flywheel/experiment              — 创建实验
 * POST   /api/v2/flywheel/experiment/:id/start    — 启动实验
 * POST   /api/v2/flywheel/experiment/:id/pause    — 暂停实验
 * POST   /api/v2/flywheel/experiment/:id/conclude — 结束实验
 * GET    /api/v2/flywheel/experiment/:id/analysis  — 分析结果
 * POST   /api/v2/flywheel/experiment/assign       — 分配变体
 * POST   /api/v2/flywheel/experiment/metric       — 记录指标
 * GET    /api/v2/flywheel/experiment/active        — 活跃实验
 * GET    /api/v2/flywheel/experiment/history       — 实验历史
 * 
 * === Dashboard ===
 * GET    /api/v2/flywheel/dashboard               — 学习仪表盘
 * GET    /api/v2/flywheel/dashboard/leaderboard   — Agent排行榜
 * GET    /api/v2/flywheel/dashboard/health        — 飞轮健康度
 * GET    /api/v2/flywheel/dashboard/trends        — 趋势分析
 * 
 * === Loop ===
 * POST   /api/v2/flywheel/loop/trigger            — 触发改进循环
 * POST   /api/v2/flywheel/loop/schedule           — 配置调度
 * GET    /api/v2/flywheel/loop/active             — 活跃循环
 * GET    /api/v2/flywheel/loop/history            — 循环历史
 * POST   /api/v2/flywheel/loop/:id/cancel         — 取消循环
 * GET    /api/v2/flywheel/loop/schedules          — 所有调度配置
 */
