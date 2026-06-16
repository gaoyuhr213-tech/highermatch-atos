/**
 * 蓉才通™ ATOS — Post-Interview Report Generation Prompt (Module 3)
 * 
 * 后置离线 · 终版审计输出
 * 
 * 加载时机：InterviewOrchestrator.endSession() 面试结束事件触发
 * 生命周期：一次性生成，配合完整上下文产出终版报告
 * Token 预算：~1,500 tokens
 * 
 * @see docs/prompts/interview-agent-system.md
 */

import type { CompetencyDimension } from './base-system';

/**
 * 面试报告输入上下文
 */
export interface ReportGenerationContext {
  sessionId: string;
  tenantId: string;
  candidateId: string;
  positionId: string;
  fullTranscript: string;
  timelineEvents: TimelineEvent[];
  finalScores: Record<CompetencyDimension, number>;
  followUpHistory: FollowUpRecord[];
  totalDurationSeconds: number;
  coreQuestionsCompleted: number;
}

export interface TimelineEvent {
  type: string;
  timestampSec: number;
  description: string;
  videoAnchor: { startSec: number; endSec: number };
}

export interface FollowUpRecord {
  tier: 'clarify' | 'deep_dive' | 'stress_challenge';
  question: string;
  triggerReason: string;
  candidateResponse?: string;
}

/**
 * 构建报告生成提示词
 */
export function buildReportGenerationPrompt(ctx: ReportGenerationContext): string {
  const scoresSummary = Object.entries(ctx.finalScores)
    .map(([dim, score]) => `- ${dim}: ${score}/10`)
    .join('\n');

  const timelineSummary = ctx.timelineEvents.length > 0
    ? ctx.timelineEvents.map(e => `[${e.timestampSec}s] ${e.type}: ${e.description}`).join('\n')
    : 'No timeline events recorded';

  const followUpSummary = ctx.followUpHistory.length > 0
    ? ctx.followUpHistory.map(f => `[${f.tier}] ${f.question} — Trigger: ${f.triggerReason}`).join('\n')
    : 'No follow-up questions generated';

  return `${REPORT_GENERATION_PROMPT}

## Interview Session Data

### Session Metadata
- Session ID: ${ctx.sessionId}
- Duration: ${Math.floor(ctx.totalDurationSeconds / 60)}m ${ctx.totalDurationSeconds % 60}s
- Core Questions Completed: ${ctx.coreQuestionsCompleted}/5

### Final Competency Scores
${scoresSummary}

### Full ASR Transcript
${ctx.fullTranscript}

### Timeline Events (Camera Visual Signals)
${timelineSummary}

### Follow-up Questions Generated
${followUpSummary}

## Instructions
Generate the complete 6-section interview report in JSON format. Every conclusion must carry dual evidence anchors (camera timestamp + transcript quote) for CA signature audit compliance.`;
}

/**
 * 报告生成核心提示词
 */
export const REPORT_GENERATION_PROMPT = `## Post-Interview Full Competency Report (Module 3)

Generate a comprehensive interview evaluation report for enterprise HR audit. This report will be CA-signed and stored as an immutable audit record.

### Report Structure (6 Mandatory Sections)

**Section 1 | Overall Interview Summary**
- Final composite score (0-10)
- Hire recommendation: Strong Hire / Hire / Neutral / Lean No Hire / Not Recommended
- Top 3 strengths with camera visual + transcript dual evidence
- Top 3 red risk flags with camera visual behavioral evidence snippet

**Section 2 | Dimension-by-Dimension Competency Breakdown**
For each of 5 dimensions (Leadership / Communication / Execution / Ownership / Stress Resistance):
- Final score (0-10) with confidence level
- Strength Evidence: camera timestamp range + transcript quote
- Gap/Risk Evidence: camera timestamp range + transcript quote
- Score trajectory (how it evolved during the interview)

**Section 3 | Case Deep Dive Evaluation**
For each of the 5 core questions answered:
1) Technical depth & business ROI assessment
2) Identified blind spots (silo bias, risk ignoring, lack of financial measurement, weak change management)
3) Camera behavioral performance during this case (eye contact %, stress signals, confidence level)
4) STAR completeness score (Situation/Task/Action/Result each 0-100%)

**Section 4 | Camera Visual Behavioral Risk Audit Log**
Full chronological list of ALL camera events for enterprise audit & labor compliance:
- Feed loss records with exact timestamps
- Gaze avoidance episodes with duration
- Stress micro-expression timestamps
- Defensive body language occurrences
- Confidence markers (positive signals)
This section is required for CA signature compliance storage.

**Section 5 | Recommended Follow-up Live Interview Questions**
Tiered question pool for subsequent human live panel interview:
- Questions targeting visual/verbal gaps detected in async interview
- Prioritized by risk severity (high → medium → low)
- Each question explains what gap it addresses

**Section 6 | Interview Video Retrieval Index**
Table mapping all key evaluation conclusions to exact camera video time ranges:
- Supports one-click playback of critical footage for HR cross-review
- Format: { conclusion, videoStartSec, videoEndSec, transcriptLineRange, dimension }

### Quality Standards
- Every claim backed by dual evidence (transcript + camera)
- Use direct quotes where impactful
- Be objective — report facts, not impressions
- Quantify where possible
- Flag low-confidence assessments explicitly
- All timestamps must be precise to the second`;

/**
 * 报告输出 JSON Schema
 */
export const REPORT_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    section1_summary: {
      type: 'object',
      properties: {
        compositeScore: { type: 'number', minimum: 0, maximum: 10 },
        recommendation: { type: 'string', enum: ['strong_hire', 'hire', 'neutral', 'lean_no_hire', 'not_recommended'] },
        topStrengths: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              cameraEvidence: { type: 'string' },
              transcriptEvidence: { type: 'string' },
            },
          },
          maxItems: 3,
        },
        riskFlags: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              severity: { type: 'string', enum: ['high', 'medium', 'low'] },
              cameraEvidence: { type: 'string' },
              transcriptEvidence: { type: 'string' },
            },
          },
          maxItems: 3,
        },
      },
      required: ['compositeScore', 'recommendation', 'topStrengths', 'riskFlags'],
    },
    section2_competency_breakdown: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          dimension: { type: 'string' },
          finalScore: { type: 'number' },
          confidence: { type: 'number' },
          strengthEvidence: {
            type: 'object',
            properties: {
              cameraTimestamp: { type: 'string' },
              transcriptQuote: { type: 'string' },
            },
          },
          gapEvidence: {
            type: 'object',
            properties: {
              cameraTimestamp: { type: 'string' },
              transcriptQuote: { type: 'string' },
            },
          },
          trajectory: { type: 'string' },
        },
        required: ['dimension', 'finalScore', 'confidence'],
      },
    },
    section3_case_evaluation: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          questionId: { type: 'string' },
          technicalDepth: { type: 'string' },
          businessROI: { type: 'string' },
          blindSpots: { type: 'array', items: { type: 'string' } },
          cameraBehavior: {
            type: 'object',
            properties: {
              eyeContactPct: { type: 'number' },
              stressLevel: { type: 'string', enum: ['low', 'moderate', 'high'] },
              confidenceLevel: { type: 'string', enum: ['low', 'moderate', 'high'] },
            },
          },
          starCompleteness: {
            type: 'object',
            properties: {
              situation: { type: 'number' },
              task: { type: 'number' },
              action: { type: 'number' },
              result: { type: 'number' },
            },
          },
        },
        required: ['questionId', 'technicalDepth', 'blindSpots'],
      },
    },
    section4_visual_audit_log: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          timestampSec: { type: 'number' },
          eventType: { type: 'string' },
          description: { type: 'string' },
          durationSec: { type: 'number' },
          severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
        },
        required: ['timestampSec', 'eventType', 'description'],
      },
    },
    section5_followup_questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          targetGap: { type: 'string' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          dimension: { type: 'string' },
        },
        required: ['question', 'targetGap', 'priority'],
      },
    },
    section6_video_index: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          conclusion: { type: 'string' },
          videoStartSec: { type: 'number' },
          videoEndSec: { type: 'number' },
          transcriptLineRange: { type: 'string' },
          dimension: { type: 'string' },
        },
        required: ['conclusion', 'videoStartSec', 'videoEndSec'],
      },
    },
  },
  required: ['section1_summary', 'section2_competency_breakdown', 'section3_case_evaluation', 'section4_visual_audit_log', 'section5_followup_questions', 'section6_video_index'],
} as const;
