/**
 * 蓉才通™ ATOS — Real-Time Inference Loop Prompt (Module 2)
 * 
 * 中层增量逻辑 · 流式运行
 * 
 * 加载时机：每次 processAudioChunk → onTranscriptReady 时注入
 * 生命周期：每轮推理独立注入，不累积历史
 * Token 预算：~2,800 tokens
 * 
 * @see docs/prompts/interview-agent-system.md
 */

import type { CompetencyDimension } from './base-system';

/**
 * 摄像头视觉信号类型定义
 */
export interface CameraVisualSignal {
  type: CameraSignalType;
  confidence: number;       // 0-1
  timestampSec: number;
  durationSec?: number;
  description: string;
}

export type CameraSignalType =
  | 'eye_contact'           // 眼神接触
  | 'gaze_avoidance'        // 视线回避
  | 'defensive_expression'  // 防御性微表情
  | 'confidence_marker'     // 自信标记
  | 'off_camera'            // 离开画面
  | 'speech_rhythm_mismatch'// 语速节奏异常
  | 'stress_signal'         // 压力信号
  | 'ownership_signal'      // 责任担当信号
  | 'communication_signal'  // 沟通信号
  | 'leadership_signal'     // 领导力信号
  | 'long_pause'            // 长时间沉默
  | 'camera_feed_loss';     // 摄像头信号丢失

/**
 * 构建实时推理循环提示词
 * 
 * @param currentTranscript - 当前轮次的 ASR 转录文本
 * @param visualSignals - 当前轮次提取的摄像头视觉信号
 * @param currentQuestionIdx - 当前题目索引 (0-based)
 * @param accumulatedScores - 累积能力评分快照
 */
export function buildRealtimeLoopPrompt(params: {
  currentTranscript: string;
  visualSignals: CameraVisualSignal[];
  currentQuestionIdx: number;
  accumulatedScores: Record<CompetencyDimension, number>;
  elapsedSeconds: number;
}): string {
  const { currentTranscript, visualSignals, currentQuestionIdx, accumulatedScores, elapsedSeconds } = params;

  const visualContext = visualSignals.length > 0
    ? visualSignals.map(s => `[${s.timestampSec}s] ${s.type} (confidence: ${(s.confidence * 100).toFixed(0)}%): ${s.description}`).join('\n')
    : '[No visual signals detected in this segment]';

  const scoreContext = Object.entries(accumulatedScores)
    .map(([dim, score]) => `${dim}: ${score}/10`)
    .join(' | ');

  return `${REALTIME_LOOP_PROMPT}

## Current Context (This Inference Cycle)

### ASR Transcript Segment (Latest)
${currentTranscript}

### Camera Visual Signals Detected
${visualContext}

### Session State
- Current Question: Q${currentQuestionIdx + 1}/5
- Elapsed Time: ${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s
- Accumulated Scores: ${scoreContext}

## Instructions
Analyze the above dual-stream data (transcript + camera signals) and output the 5 synchronized blocks in JSON format.
Every score adjustment and follow-up question MUST cite both verbal evidence (transcript quote) and visual evidence (camera signal with timestamp).`;
}

/**
 * 实时推理循环核心提示词
 */
export const REALTIME_LOOP_PROMPT = `## Real-Time Inference Loop (Module 2)

### Step 1: Dual Stream Fusion Analysis
Extract and evaluate these 10 mandatory visual signals from candidate camera stream:
1) Eye contact ratio with camera lens (0%-100%)
2) Average speech pause duration after question prompt
3) Defensive micro-expression frequency (brow furrow, lip compression, gaze shift)
4) Confidence visual markers (steady posture, consistent camera gaze, calm gesture)
5) Off-camera event detection (leaving frame, covering lens, screen dark)
6) Speech rhythm mismatch (rambling vs concise, cross-match with body tension)
7) Stress resistance visual signal (fidgeting, repeated head movement, voice shake)
8) Ownership signal (direct gaze when claiming responsibility vs shifting when blaming)
9) Communication signal (hand gesture coordination vs rigid closed posture)
10) Leadership signal (upright open posture for team decisions vs slouched for delegated work)

**Fusion Rule**: NO score adjustment, NO follow-up generation without pairing verbal transcript content + minimum 1 camera visual signal evidence tag.

**Camera Exception Logic**:
- Feed loss >8s → Red warning timeline event + clarification question about camera positioning
- Gaze avoidance >60% during answer → Stress deep-dive follow-up + timeline flag "Low camera gaze engagement"

### Step 2: Tiered Dynamic Follow-up Generation
For the candidate's answer to the current core question, generate follow-ups sorted by tier:

**Tier 1 | Clarify** (Low pressure):
- Trigger: Ambiguous words ("some results", "many improvements", "the team had issues")
- Requirement: Force quantification — specific numbers, tech stacks, team size, timeline
- Each question must bind [Video Anchor: XXs-XXs] + [Transcript Line N]

**Tier 2 | Deep Dive** (Medium pressure):
- Trigger: Skipped risk tradeoff, ignored cost/finance, avoided conflict details
- Focus: Architecture tradeoff cost, silo root cause, high-stakes downside risk, org change resistance

**Tier 3 | Stress Challenge** (High pressure):
- Trigger: High defensive visual signals + evasive verbal answers
- Construct neutral challenging questions targeting contradictions
- Test ownership: "What part of this failure was your direct responsibility?"

### Step 3: Real-Time Competency Score Synchronization
Update 5 dimensions (0-10 scale) with delta changes:
- Leadership ↑: End-to-end team decision description + steady direct eye contact
- Communication ↓: Rambling speech + frequent gaze shift, disjointed gestures
- Execution ↑: Quantifiable business outcome + calm posture under delivery pressure
- Ownership ↓: Blame-shifting + looks away when discussing failures
- Stress Resistance ↓: Long pauses + fidgeting + brow furrow on deep-dive questions

Every score change must show dual evidence:
- Verbal Evidence: Transcript timestamp + quote snippet
- Camera Visual Evidence: Video frame time range + behavioral signal

### Step 4: Transcript-Video Anchor Binding
Map every ASR segment to camera timestamp. Label each segment with visual tag:
[Steady Camera Gaze] / [Defensive Gaze Shift] / [Long Silent Pause] / [High Stress Expression] / [Confident Posture] / [Neutral]

### Step 5: Timeline Auto Marker Generation
Generate timeline event cards triggered ONLY by camera visual signals:
- Confidence Marker: 80%+ eye contact sustained >15s
- Stress Risk Marker: Defensive signals + gaze avoidance >10s
- Camera Exception Marker: Feed loss / covering lens / leaving frame
- Evasion Marker: Gaze shift on risk/ownership questions
- Long Pause Marker: >4s silence after question

Each card carries: 1) Jump to video segment 2) Related follow-up question

### Step 6: Base Question Bank Spine Protection
Never rewrite/skip/replace the 5 core questions. Track completion percentage. Push reminder if candidate skips any core question.`;

/**
 * 实时推理输出的 JSON Schema（用于 LLM structured output）
 */
export const REALTIME_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    block1_question_sync: {
      type: 'object',
      properties: {
        currentQuestion: { type: 'number' },
        completionPct: { type: 'number' },
        remainingQuestions: { type: 'array', items: { type: 'string' } },
        skipWarning: { type: 'string', nullable: true },
      },
      required: ['currentQuestion', 'completionPct', 'remainingQuestions'],
    },
    block2_followup_queue: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tier: { type: 'string', enum: ['clarify', 'deep_dive', 'stress_challenge'] },
          question: { type: 'string' },
          videoAnchor: { type: 'object', properties: { startSec: { type: 'number' }, endSec: { type: 'number' } } },
          transcriptLine: { type: 'number' },
          triggerReason: { type: 'string' },
        },
        required: ['tier', 'question', 'videoAnchor', 'transcriptLine', 'triggerReason'],
      },
    },
    block3_competency_scores: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          dimension: { type: 'string', enum: ['leadership', 'communication', 'execution', 'ownership', 'stress_resistance'] },
          score: { type: 'number' },
          delta: { type: 'number' },
          verbalEvidence: { type: 'object', properties: { timestamp: { type: 'string' }, quote: { type: 'string' } } },
          visualEvidence: { type: 'object', properties: { timeRange: { type: 'string' }, signal: { type: 'string' } } },
        },
        required: ['dimension', 'score', 'delta', 'verbalEvidence', 'visualEvidence'],
      },
    },
    block4_transcript_anchors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          videoTimeRange: { type: 'object', properties: { startSec: { type: 'number' }, endSec: { type: 'number' } } },
          visualTag: { type: 'string', enum: ['steady_gaze', 'defensive_shift', 'long_pause', 'stress_expression', 'confident', 'neutral'] },
        },
        required: ['text', 'videoTimeRange', 'visualTag'],
      },
    },
    block5_timeline_events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['confidence', 'stress_risk', 'camera_exception', 'evasion', 'long_pause'] },
          timestampSec: { type: 'number' },
          description: { type: 'string' },
          jumpToVideo: { type: 'object', properties: { startSec: { type: 'number' }, endSec: { type: 'number' } } },
          relatedFollowUp: { type: 'string', nullable: true },
        },
        required: ['type', 'timestampSec', 'description', 'jumpToVideo'],
      },
    },
  },
  required: ['block1_question_sync', 'block2_followup_queue', 'block3_competency_scores', 'block4_transcript_anchors', 'block5_timeline_events'],
} as const;
