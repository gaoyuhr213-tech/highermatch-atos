/**
 * 蓉才通™ ATOS — Interview Agent Prompts Unified Entry
 * 
 * 三模块提示词统一导出：
 * - Module 1 (base-system): 全局基座，createSession 时常驻加载
 * - Module 2 (realtime-loop): 实时推理循环，每轮 inference 注入
 * - Module 3 (report-generation): 报告生成，endSession 时触发
 * 
 * 加载顺序：Module 1 → Module 2 (streaming) → Module 3 (on end)
 */

// Module 1 — Base System (Global Spine)
export {
  BASE_SYSTEM_PROMPT,
  CORE_QUESTION_BANK,
  type CoreQuestionId,
  type CompetencyDimension,
} from './base-system';

// Module 2 — Real-Time Inference Loop
export {
  buildRealtimeLoopPrompt,
  REALTIME_LOOP_PROMPT,
  REALTIME_OUTPUT_SCHEMA,
  type CameraVisualSignal,
  type CameraSignalType,
} from './realtime-loop';

// Module 3 — Report Generation
export {
  buildReportGenerationPrompt,
  REPORT_GENERATION_PROMPT,
  REPORT_OUTPUT_SCHEMA,
  type ReportGenerationContext,
  type TimelineEvent,
  type FollowUpRecord,
} from './report-generation';

// ─── Existing prompts (backward compatible) ─────────────────────────────────
export { COMPETENCY_PROMPT } from './competency';
export { FOLLOWUP_PROMPT } from './followup';
export { SCORING_PROMPT } from './scoring';
export { STAR_PROMPT } from './star';
export { SUMMARY_PROMPT } from './summary';
