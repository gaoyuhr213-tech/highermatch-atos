# Phase 12 — Learning Flywheel 交付文档

**交付日期**: 2026-06-15  
**Commit**: `9331329` → `main` @ `gaoyuhr213-tech/highermatch-atos`  
**文件数**: 6 files / 3,314 insertions  
**构建验证**: TypeScript 0 errors / Vite Build 1.68s 通过

---

## Executive Summary

Phase 12 构建了蓉才通™ ATOS 的**数据飞轮系统**（Learning Flywheel），实现从用户反馈到模型自动优化的完整闭环。这是系统从"AI功能集合"进化为"自我进化的AI Recruiting OS"的关键里程碑。

对标：**OpenAI Evals** + **LangSmith** + **Eightfold Learning Loop** + **Palantir AIP Feedback**

---

## 八大模块交付清单

| 模块 | 文件 | 核心能力 | 对标 |
|------|------|----------|------|
| Feedback Engine | `feedback.ts` | ThumbUp/Down + Correction + ManualRanking + ManualScore + 聚合 | OpenAI Feedback |
| Implicit Signals | `feedback.ts` | 15种信号采集 + 时间衰减 + 位置偏差校正 + 综合质量分 | LinkedIn Signals |
| Label Engine | `feedback.ts` | 4种结果标签(hire/performance/retention/promotion) + 自动生成 + 人工验证 | Eightfold Labels |
| Dataset Builder | `dataset.ts` | Golden/Regression/Failure/Replay 4类数据集 + 策展(去重/质量/多样性) | LangSmith Datasets |
| Prompt Optimizer | `dataset.ts` | 5种问题检测 + 5种优化策略 + 版本管理 + Diff + Rollback | OpenAI Evals |
| Experiment Platform | `experiment.ts` | A/B Testing + 4种流量分配 + Z-test统计分析 + 自动胜出判定 | Statsig / LaunchDarkly |
| Learning Dashboard | `loop.ts` | Agent排行榜 + 飞轮健康度 + 趋势分析 + 一屏看全局 | LangFuse Dashboard |
| Continuous Improvement | `loop.ts` | 8阶段闭环编排 + 退化自动触发 + 反馈阈值触发 + 调度配置 | Palantir AIP Loop |

---

## 数据飞轮架构

```
Feedback → Signals → Labels → Dataset → Eval → Optimize → Experiment → Deploy → Monitor → Learn
    ↑                                                                                        │
    └────────────────────────────────────────────────────────────────────────────────────────┘
```

**关键设计决策：**

1. **信号权重矩阵**：15种隐式信号，权重从 click(0.05) 到 promotion(1.00)，支持时间衰减和位置偏差校正
2. **标签自动生成**：基于信号触发 + 观察窗口 + 置信度门控，支持人工验证覆写
3. **数据集策展**：自动去重 + 质量评分 + 多样性评估 + 覆盖度计算
4. **统计严谨性**：Z-test显著性检验 + 置信区间 + 效果量(Cohen's d) + Power分析
5. **自动化级别可配**：autoOptimize / autoExperiment / autoDeploy 三级开关

---

## DB Schema 设计（11张表）

| 表名 | 用途 | 关键索引 |
|------|------|----------|
| `feedback_entries` | 显式反馈 | (tenant_id, agent_id, timestamp) |
| `implicit_signals` | 隐式信号 | (tenant_id, entity_type, entity_id, timestamp) |
| `outcome_labels` | 结果标签 | (tenant_id, label_type, candidate_id) |
| `datasets` | 数据集 | (tenant_id, agent_id, type) |
| `dataset_entries` | 数据集条目 | (dataset_id, quality) |
| `prompt_versions` | Prompt版本 | (agent_id, status) |
| `prompt_issues` | Prompt问题 | (agent_id, status, severity) |
| `experiments` | A/B实验 | (tenant_id, status) |
| `experiment_assignments` | 实验分配 | UNIQUE(experiment_id, user_id) |
| `improvement_cycles` | 改进循环 | (tenant_id, agent_id, status) |
| `learning_metrics` | 学习指标时序 | (tenant_id, period, timestamp) |

---

## API 端点（42个）

覆盖全部8个模块的CRUD + 分析 + 触发操作：
- Feedback: 4 endpoints
- Signals: 3 endpoints
- Labels: 4 endpoints
- Dataset: 6 endpoints
- Prompt: 7 endpoints
- Experiment: 9 endpoints
- Dashboard: 4 endpoints
- Loop: 5 endpoints

---

## Redis Key 设计

```
flywheel:{tenantId}:feedback:recent:{agentId}          — 最近反馈 (List, TTL 7d)
flywheel:{tenantId}:signals:score:{entityId}           — 实体综合分 (String, TTL 1d)
flywheel:{tenantId}:experiment:assign:{expId}:{userId} — 实验分配 (String)
flywheel:{tenantId}:loop:active:{agentId}              — 活跃循环 (String, TTL 24h)
flywheel:{tenantId}:dashboard:cache:{period}           — Dashboard缓存 (JSON, TTL 5min)
flywheel:{tenantId}:prompt:current:{agentId}           — 当前Prompt版本 (String)
```

---

## 系统能力矩阵（Phase 12 后）

| 维度 | Phase 11 | Phase 12 | 状态 |
|------|----------|----------|------|
| Intelligence | Agent Pipeline | ✓ | 已具备 |
| Memory | 6层长期记忆 | ✓ | 已具备 |
| Evaluation | 5维度评估 | ✓ | 已具备 |
| Observability | 全链路追踪 | ✓ | 已具备 |
| Human Control | 置信度门控 | ✓ | 已具备 |
| Multimodal | Audio+Video | ✓ | 已具备 |
| Autonomy | NL→多Agent | ✓ | 已具备 |
| **Feedback Loop** | 无 | 显式+隐式反馈 | **新增** |
| **Data Flywheel** | 无 | 8阶段闭环 | **新增** |
| **Self-Improvement** | 无 | 自动检测+优化+实验+部署 | **新增** |
| **Experimentation** | 无 | A/B Testing + 统计分析 | **新增** |

---

## 飞轮运转机制

**触发条件（3种）：**
1. **定时触发**：Cron表达式（默认每周一凌晨2点）
2. **退化触发**：成功率下降超过阈值（默认10%）
3. **反馈触发**：负面反馈率超过阈值（默认30%）且反馈数≥20

**8阶段执行：**
1. Feedback — 收集并分析近期反馈
2. Dataset — 从修正构建Failure集，从高置信度构建Golden集
3. Eval — 运行回归测试 + Golden评估
4. Optimize — 检测问题 + 自动生成优化Prompt
5. Experiment — 创建A/B实验（优化版 vs 当前版）
6. Deploy — 部署获胜版本（可配置自动/手动）
7. Monitor — 监控部署后24h指标
8. Learn — 记录学习成果，更新Agent Memory

---

## 下一步建议（Phase 13）

1. **Multi-tenant Isolation** — 企业级租户隔离 + 数据隔离
2. **Compliance Engine** — GDPR/个保法合规引擎 + 数据脱敏
3. **Edge Deployment** — 本地化部署方案 + 模型蒸馏
4. **SDK & API Gateway** — 开放平台 + 第三方集成
5. **Production Hardening** — 限流/熔断/降级/灰度
