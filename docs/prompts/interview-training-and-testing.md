# AI Interview Agent — 面试官评审标准培训材料 & 自动化测试用例生成规范

> **版本**: v1.0  
> **适用产品**: 蓉才通™ ATOS (AI Talent Operating System)  
> **文档定位**: 双重用途 — 面试官培训评审标准 + QA自动化测试用例生成规范  
> **作者**: 感知序列 AI Engineering  
> **日期**: 2026-06-16

---

## 1. Executive Summary

本文档将AI面试Agent三模块系统提示词转化为两个核心用途：

1. **面试官评审标准培训材料** — 让人类面试官理解AI评分逻辑，校准人机评分一致性
2. **自动化面试场景测试用例生成规范** — 为QA团队提供结构化的测试用例模板，覆盖全链路场景

---

## 2. 面试官评审标准培训材料

### 2.1 培训目标

| 培训层级 | 目标受众 | 核心能力 |
|----------|----------|----------|
| L1 基础认知 | 全体面试官 | 理解AI 5维度评分框架、STAR方法论、摄像头信号含义 |
| L2 校准对齐 | 资深面试官 | 能够独立完成人机评分对齐，识别AI评分偏差 |
| L3 审计监督 | HRBP/HRD | 能够审计AI面试报告合规性，判断CA签名有效性 |

### 2.2 五维度能力评估框架（对齐Module 1基座）

#### 评分标准矩阵

| 维度 | 0-3分（不达标） | 4-6分（基本达标） | 7-8分（优秀） | 9-10分（卓越） |
|------|----------------|-------------------|---------------|----------------|
| **Leadership** | 无主导经历；被动执行 | 有小范围主导经历；缺乏跨部门影响力 | 主导过关键项目；能影响上级决策 | 主导组织级变革；建立新机制/文化 |
| **Communication** | 表达混乱；逻辑断裂 | 能清晰表达；缺乏说服力 | 结构化表达；能说服不同立场方 | 能用数据量化说服C-level；跨文化沟通 |
| **Execution** | 无方法论；结果模糊 | 有基本计划；缺乏量化结果 | 系统性方法论；有明确ROI | 创新方法论；4x+量级提升 |
| **Ownership** | 仅完成分内工作 | 主动发现问题但等待指令 | 主动解决问题并推动改进 | 长期视角；为组织建立可持续机制 |
| **Stress Resistance** | 高压下崩溃/回避 | 能承受压力但决策质量下降 | 高压下保持冷静决策 | 高压下做出创新突破性决策 |

#### 摄像头视觉信号解读标准

| 视觉信号 | 含义 | 评分影响 | 面试官应注意 |
|----------|------|----------|-------------|
| 持续直视摄像头 (>80%) | 自信、Ownership | +1~2分（Leadership/Ownership） | 区分自信 vs 刻意表演 |
| 视线回避 (>3秒) | 可能回避问题核心 | 触发追问（不直接扣分） | 结合语言内容判断 |
| 防御性肢体语言 | 压力信号 | 标记为Stress事件 | 不应作为唯一扣分依据 |
| 长时间停顿 (>5秒) | 思考/回避/不确定 | 触发追问 | 区分深度思考 vs 无话可说 |
| 自信开放姿态 | 积极信号 | +0.5~1分（Communication） | 需与语言内容一致 |

### 2.3 STAR方法论评审标准

#### STAR完整度评分表

| 组件 | 完整标准 | 常见缺陷 | 追问策略 |
|------|----------|----------|----------|
| **Situation** | 有具体场景、时间、规模、利益相关方 | 过于笼统；缺乏量化背景 | "当时团队规模多大？影响范围？" |
| **Task** | 明确个人职责、目标、约束条件 | 混淆团队目标与个人目标 | "在这个项目中，您个人的具体职责是？" |
| **Action** | 具体步骤、方法论、决策逻辑 | 只说结果不说过程 | "您具体做了哪些步骤？为什么选择这个方案？" |
| **Result** | 量化结果、业务影响、持续性 | 缺乏数据；只有定性描述 | "最终的量化结果是什么？对业务的长期影响？" |

### 2.4 分层追问机制培训

| 追问层级 | 触发条件 | 目的 | 示例 |
|----------|----------|------|------|
| **Clarify** | STAR某组件缺失/模糊 | 补充信息完整性 | "您提到了结果，能否补充具体的行动步骤？" |
| **Deep Dive** | 发现能力信号但深度不足 | 验证能力真实性 | "您如何量化风险来说服CTO？具体数据是什么？" |
| **Stress Challenge** | 摄像头检测到回避/防御信号 | 压力测试Ownership | "迁移中最大的事故是什么？您个人承担了什么责任？" |

### 2.5 人机评分校准流程

```
Step 1: AI完成面试评分 → 输出5维度分数 + 双证据
Step 2: 人类面试官独立评分（不看AI结果）
Step 3: 对比差异 → 差异>2分的维度进入校准讨论
Step 4: 回看视频片段（AI提供精确时间锚点）
Step 5: 达成共识分数 → 记录校准理由
Step 6: 反馈至AI模型（Learning Loop）
```

---

## 3. 自动化面试场景测试用例生成规范

### 3.1 测试覆盖矩阵

| 测试类别 | 覆盖范围 | 优先级 |
|----------|----------|--------|
| Module 1 基座加载 | 会话创建、题库保护、角色锁定 | P0 |
| Module 2 实时推理 | 5 Block输出完整性、双流融合、追问触发 | P0 |
| Module 3 报告生成 | 6段报告完整性、CA签名、证据锚定 | P0 |
| 摄像头信号处理 | 信号识别、事件触发、证据标签 | P1 |
| 异常场景 | 网络断连、音频丢失、摄像头故障 | P1 |
| 合规审计 | 数据隔离、CA签名验证、审计日志 | P0 |

### 3.2 测试用例模板

#### Template A: 正常面试流程（Happy Path）

```yaml
test_case_id: INT-HP-001
title: "完整面试流程 — 5题全部完成，高分候选人"
preconditions:
  - Session created with 5 core questions
  - WebSocket connected
  - Camera + Mic active
steps:
  - action: "Start interview session"
    expected: "Module 1 base prompt loaded; status → in_progress"
  - action: "Send ASR transcript chunk 1 (Situation)"
    expected: "Block 4 renders transcript with visualTag; Block 5 adds confidence event"
  - action: "Send ASR transcript chunk 2 (Task)"
    expected: "Block 3 Leadership score updates with delta; dual evidence attached"
  - action: "Send ASR transcript chunk 3 (Action)"
    expected: "Block 3 Execution score updates; Block 2 may generate Clarify follow-up"
  - action: "Send ASR transcript chunk 4 (Result)"
    expected: "Block 3 all dimensions updated; Block 1 question marked complete"
  - action: "Advance to question 2"
    expected: "Block 1 progress bar advances; spine protection prevents skip"
  - action: "Complete all 5 questions"
    expected: "All questions marked complete in Block 1"
  - action: "End interview"
    expected: "Module 3 report generated; 6 sections complete; CA signed"
assertions:
  - "All 5 Block outputs are non-empty"
  - "Every competency score has both verbalEvidence and visualEvidence"
  - "Report section4_visual_audit_log has ≥3 entries"
  - "Report section6_video_index maps to valid time ranges"
```

#### Template B: 摄像头异常场景

```yaml
test_case_id: INT-CAM-001
title: "摄像头信号丢失 — Feed Loss Recovery"
preconditions:
  - Session in_progress
  - Camera was active
steps:
  - action: "Simulate camera feed loss (no visual signals for 10s)"
    expected: "Block 5 adds camera_exception event with timestamp"
  - action: "Resume camera feed"
    expected: "Block 5 adds recovery event; scoring continues"
  - action: "End interview"
    expected: "Report section4 includes feed_loss record with exact timestamps"
assertions:
  - "camera_exception event has precise timestampSec"
  - "Report marks low-confidence for scores during feed loss period"
  - "Audit log records duration of camera unavailability"
```

#### Template C: 压力追问触发

```yaml
test_case_id: INT-STRESS-001
title: "摄像头检测防御信号 → 触发Stress Challenge追问"
preconditions:
  - Session in_progress, question 1 active
  - Candidate has provided Situation + Task
steps:
  - action: "Send visual signal: gaze_avoidance (duration: 4s)"
    expected: "Block 5 adds stress_risk event"
  - action: "Send ASR transcript with hesitation markers"
    expected: "Block 4 renders with defensive_shift visualTag"
  - action: "Wait for Module 2 inference cycle"
    expected: "Block 2 generates stress_challenge tier follow-up"
  - action: "Verify follow-up metadata"
    expected: "videoAnchor points to gaze avoidance timestamp; triggerReason mentions defensive signal"
assertions:
  - "Follow-up tier is stress_challenge (not clarify or deep_dive)"
  - "triggerReason references camera visual signal"
  - "videoAnchor.startSec matches gaze_avoidance event timestamp"
```

#### Template D: 题库脊柱保护

```yaml
test_case_id: INT-SPINE-001
title: "核心题库不可被跳过或替换"
preconditions:
  - Session created with 5 core questions
steps:
  - action: "Attempt to skip question 2 via advanceQuestion"
    expected: "Question 2 remains active; skip rejected"
  - action: "Attempt to replace question 3 content"
    expected: "Original question preserved; replacement rejected"
  - action: "Verify question order after interview"
    expected: "All 5 core questions asked in original order"
assertions:
  - "CORE_QUESTION_BANK integrity maintained"
  - "No question ID modified during session"
  - "Report reflects all 5 questions evaluated"
```

### 3.3 测试数据生成规范

#### 候选人画像模板

| 画像类型 | 特征 | 预期评分范围 | 用途 |
|----------|------|-------------|------|
| **Strong Hire** | 完整STAR、量化结果、自信视觉信号 | 80-95 | 验证高分路径 |
| **Borderline** | 部分STAR缺失、混合视觉信号 | 55-70 | 验证追问触发 |
| **Not Recommended** | 回避核心问题、频繁防御信号 | 20-45 | 验证风险标记 |
| **Camera Exception** | 正常语言但摄像头频繁异常 | 50-65（低置信度） | 验证降级逻辑 |

#### ASR模拟数据格式

```json
{
  "chunkIndex": 3,
  "transcript": {
    "speaker": "candidate",
    "text": "我首先做了3周的流量分析...",
    "confidence": 0.92,
    "starTag": "action"
  },
  "visualSignals": [
    {
      "type": "steady_gaze",
      "confidence": 0.88,
      "durationSec": 12,
      "metadata": { "eyeContactPct": 91 }
    }
  ]
}
```

### 3.4 回归测试检查清单

| 检查项 | 验证方法 | 通过标准 |
|--------|----------|----------|
| Module 1 加载完整性 | 检查 sessionPromptCache | BASE_SYSTEM_PROMPT 完整存在 |
| Module 2 输出5 Block | 解析 WebSocket payload | 所有5个block字段非空 |
| Module 3 报告6段 | 解析JSON输出 | 所有6个section字段存在 |
| 双证据完整性 | 遍历competency scores | 每项有verbalEvidence + visualEvidence |
| 视频锚点有效性 | 检查所有videoAnchor | startSec < endSec, 范围在session时长内 |
| CA签名合规 | 验证签名链 | 签名有效且时间戳在session结束后 |
| 租户数据隔离 | 跨tenant查询 | 无法访问其他tenant的session数据 |

---

## 4. 实施路线图

| 阶段 | 时间 | 交付物 | 负责方 |
|------|------|--------|--------|
| Phase 1 | Week 1-2 | L1培训材料完成 + 测试框架搭建 | AI Engineering + QA |
| Phase 2 | Week 3-4 | L2校准流程试运行 + P0测试用例全覆盖 | HRBP + QA |
| Phase 3 | Week 5-6 | L3审计培训 + P1测试用例补充 + CI集成 | HRD + DevOps |
| Phase 4 | Week 7-8 | 全量上线 + Learning Loop反馈机制启动 | 全团队 |

---

## 5. 附录

### 5.1 相关文档索引

| 文档 | 路径 | 用途 |
|------|------|------|
| 三模块提示词归档 | `docs/prompts/interview-agent-system.md` | 提示词原文 + 技术规格 |
| Module 1 基座代码 | `server/ai/interview/prompts/base-system.ts` | 基座提示词实现 |
| Module 2 实时推理代码 | `server/ai/interview/prompts/realtime-loop.ts` | 实时推理实现 |
| Module 3 报告生成代码 | `server/ai/interview/prompts/report-generation.ts` | 报告生成实现 |
| Orchestrator | `server/ai/interview/orchestrator.ts` | 三模块编排逻辑 |
| 前端5 Block UI | `src/pages/b/Interview.tsx` | 5 Block同步布局 |

### 5.2 术语表

| 术语 | 定义 |
|------|------|
| **Dual-Stream** | ASR转录流 + 摄像头视频流的双数据源融合分析 |
| **Spine Protection** | 核心题库不可被AI或用户跳过/替换/修改的保护机制 |
| **CA Signed** | 面试报告经CA证书签名，确保不可篡改的审计合规性 |
| **Visual Evidence** | 摄像头分析产生的行为证据（视线、姿态、表情） |
| **Verbal Evidence** | ASR转录产生的语言证据（引用原文） |
| **Video Anchor** | 将评分结论精确映射到视频时间段的索引机制 |
| **Tier Follow-up** | 分层追问机制：Clarify → Deep Dive → Stress Challenge |
