/**
 * 蓉才通™ ATOS — Interview Session Orchestrator (v2.0)
 * 
 * 面试会话的核心编排器，协调所有Agent + 三模块提示词系统：
 * 
 * 提示词加载顺序：
 * 1. createSession → 加载 Module 1（基座系统提示词）常驻 system message
 * 2. onTranscriptReady → 注入 Module 2（实时推理循环）每轮 inference
 * 3. endSession → 触发 Module 3（报告生成）一次性输出
 * 
 * Agent 协调流程：
 * 1. 接收音频流 → 触发Whisper Worker
 * 2. 转写完成 → 双流融合分析（ASR + Camera Visual）
 * 3. 并行触发 STAR + Competency + Realtime Loop Agent
 * 4. Agent结果 → 触发Scoring Agent → 5 Block 同步输出
 * 5. 面试结束 → 触发 Module 3 报告生成
 * 
 * 状态机：
 * waiting → in_progress → (paused) → completed/cancelled
 */

import { redis, type InterviewSessionData, type InterviewQuestion } from '../shared/memory/redis';
import { enqueue } from '../shared/queue/index';
import { eventBus } from '../shared/events/bus';
import { starAgent } from './agents/star-agent';
import { competencyAgent } from './agents/competency-agent';
import { followupAgent } from './agents/followup-agent';
import { scoringAgent } from './agents/scoring-agent';
import { summaryAgent } from './agents/summary-agent';
import type { AgentContext } from './agents/base';

// ─── Module 1/2/3 Prompt System ─────────────────────────────────────────────
import {
  BASE_SYSTEM_PROMPT,
  CORE_QUESTION_BANK,
  buildRealtimeLoopPrompt,
  REALTIME_OUTPUT_SCHEMA,
  buildReportGenerationPrompt,
  REPORT_OUTPUT_SCHEMA,
  type CompetencyDimension,
  type CameraVisualSignal,
  type ReportGenerationContext,
  type TimelineEvent,
  type FollowUpRecord,
} from './prompts';

export interface CreateSessionInput {
  tenantId: string;
  candidateId: string;
  positionId: string;
  interviewerId: string;
  competencies: string[];
  questions: InterviewQuestion[];
  durationMinutes: number;
}

export interface AudioChunkInput {
  sessionId: string;
  audioUrl: string;
  format: 'webm' | 'mp3' | 'wav';
  chunkIndex: number;
  /** 摄像头视觉信号（由前端 Vision Worker 提取后随音频分片一起上报） */
  visualSignals?: CameraVisualSignal[];
}

/**
 * 5 Block 实时输出结构（WebSocket 推送至前端）
 */
export interface RealtimeBlockOutput {
  block1_question_sync: {
    currentQuestion: number;
    completionPct: number;
    remainingQuestions: string[];
    skipWarning?: string | null;
  };
  block2_followup_queue: Array<{
    tier: 'clarify' | 'deep_dive' | 'stress_challenge';
    question: string;
    videoAnchor: { startSec: number; endSec: number };
    transcriptLine: number;
    triggerReason: string;
  }>;
  block3_competency_scores: Array<{
    dimension: CompetencyDimension;
    score: number;
    delta: number;
    verbalEvidence: { timestamp: string; quote: string };
    visualEvidence: { timeRange: string; signal: string };
  }>;
  block4_transcript_anchors: Array<{
    text: string;
    videoTimeRange: { startSec: number; endSec: number };
    visualTag: string;
  }>;
  block5_timeline_events: Array<{
    type: string;
    timestampSec: number;
    description: string;
    jumpToVideo: { startSec: number; endSec: number };
    relatedFollowUp?: string | null;
  }>;
}

export class InterviewOrchestrator {
  
  /**
   * 会话级提示词上下文缓存
   * Key: sessionId → Module 1 基座提示词（常驻整个会话）
   */
  private sessionPromptCache = new Map<string, string>();

  /**
   * 会话级累积能力评分
   */
  private sessionScores = new Map<string, Record<CompetencyDimension, number>>();

  /**
   * 会话级时间线事件累积
   */
  private sessionTimeline = new Map<string, TimelineEvent[]>();

  /**
   * 会话级追问历史
   */
  private sessionFollowUps = new Map<string, FollowUpRecord[]>();

  // ─── Session Lifecycle ───────────────────────────────────────────────────────

  async createSession(input: CreateSessionInput): Promise<InterviewSessionData> {
    const sessionId = `int_${input.tenantId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    // 使用核心题库（如果未指定自定义题目）
    const questions = input.questions.length > 0
      ? input.questions
      : CORE_QUESTION_BANK.map((q, idx) => ({
          id: q.id,
          text: q.text,
          competency: q.dimensions[0],
          order: idx,
        })) as InterviewQuestion[];

    const session: InterviewSessionData = {
      sessionId,
      tenantId: input.tenantId,
      candidateId: input.candidateId,
      positionId: input.positionId,
      interviewerId: input.interviewerId,
      status: 'waiting',
      startedAt: '',
      currentQuestionIdx: 0,
      totalQuestions: questions.length,
      elapsedSeconds: 0,
      questions,
    };

    await redis.createSession(sessionId, session);

    // ─── Module 1: 基座提示词常驻加载 ───────────────────────────────────────
    this.sessionPromptCache.set(sessionId, BASE_SYSTEM_PROMPT);
    
    // 初始化累积评分（全部从 5.0 基线开始）
    this.sessionScores.set(sessionId, {
      leadership: 5.0,
      communication: 5.0,
      execution: 5.0,
      ownership: 5.0,
      stress_resistance: 5.0,
    });

    // 初始化时间线和追问历史
    this.sessionTimeline.set(sessionId, []);
    this.sessionFollowUps.set(sessionId, []);

    eventBus.publish({
      type: 'interview:session_created',
      sessionId,
      tenantId: input.tenantId,
      timestamp: new Date().toISOString(),
      data: {
        basePromptLoaded: true,
        coreQuestionCount: questions.length,
        promptModule: 'Module 1 — Base System (Spine Locked)',
      },
    });

    return session;
  }

  async startSession(sessionId: string): Promise<void> {
    await redis.updateSession(sessionId, {
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    });

    eventBus.publish({
      type: 'interview:started',
      sessionId,
      tenantId: (await redis.getSession(sessionId))?.tenantId || '',
      timestamp: new Date().toISOString(),
      data: { realtimeLoopActive: true, promptModule: 'Module 2 — Realtime Loop (Streaming)' },
    });
  }

  async pauseSession(sessionId: string): Promise<void> {
    await redis.updateSession(sessionId, { status: 'paused' });
  }

  async resumeSession(sessionId: string): Promise<void> {
    await redis.updateSession(sessionId, { status: 'in_progress' });
  }

  async endSession(sessionId: string): Promise<void> {
    const session = await redis.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    await redis.updateSession(sessionId, { status: 'completed' });

    // ─── Module 3: 报告生成触发 ─────────────────────────────────────────────
    const fullTranscript = await redis.getTranscript(sessionId);
    const finalScores = this.sessionScores.get(sessionId) || {
      leadership: 5, communication: 5, execution: 5, ownership: 5, stress_resistance: 5,
    };
    const timelineEvents = this.sessionTimeline.get(sessionId) || [];
    const followUpHistory = this.sessionFollowUps.get(sessionId) || [];

    const reportContext: ReportGenerationContext = {
      sessionId,
      tenantId: session.tenantId,
      candidateId: session.candidateId,
      positionId: session.positionId,
      fullTranscript: fullTranscript.map(t => `[${t.speaker}] ${t.text}`).join('\n'),
      timelineEvents,
      finalScores,
      followUpHistory,
      totalDurationSeconds: session.elapsedSeconds,
      coreQuestionsCompleted: session.currentQuestionIdx + 1,
    };

    // 构建 Module 3 报告生成提示词
    const reportPrompt = buildReportGenerationPrompt(reportContext);

    // 同时运行原有 summaryAgent（向后兼容）+ Module 3 报告
    const context = await this.buildContext(sessionId, session);
    const [legacyReport, _] = await Promise.all([
      summaryAgent.execute(context),
      // Module 3 报告通过事件总线发布，由专门的 Report Agent 处理
      this.publishReportGenerationEvent(sessionId, session.tenantId, reportPrompt, reportContext),
    ]);

    if (legacyReport.success) {
      eventBus.publish({
        type: 'interview:completed',
        sessionId,
        tenantId: session.tenantId,
        timestamp: new Date().toISOString(),
        data: {
          report: legacyReport.data,
          promptModule: 'Module 3 — Report Generation (Triggered)',
          reportPromptInjected: true,
        },
      });
    }

    // 清理会话缓存
    this.sessionPromptCache.delete(sessionId);
    this.sessionScores.delete(sessionId);
    this.sessionTimeline.delete(sessionId);
    this.sessionFollowUps.delete(sessionId);
  }

  async cancelSession(sessionId: string): Promise<void> {
    await redis.updateSession(sessionId, { status: 'cancelled' });
    // 清理缓存
    this.sessionPromptCache.delete(sessionId);
    this.sessionScores.delete(sessionId);
    this.sessionTimeline.delete(sessionId);
    this.sessionFollowUps.delete(sessionId);
  }

  // ─── Audio Processing ──────────────────────────────────────────────────────

  async processAudioChunk(input: AudioChunkInput): Promise<void> {
    const session = await redis.getSession(input.sessionId);
    if (!session || session.status !== 'in_progress') {
      throw new Error(`Session ${input.sessionId} is not active`);
    }

    // Enqueue Whisper transcription + 附带摄像头视觉信号
    await enqueue('whisper', {
      sessionId: input.sessionId,
      tenantId: session.tenantId,
      audioUrl: input.audioUrl,
      format: input.format,
      chunkIndex: input.chunkIndex,
      visualSignals: input.visualSignals || [],
    });
  }

  // ─── Transcript Processing (called after Whisper completes) ────────────────

  async onTranscriptReady(sessionId: string, visualSignals?: CameraVisualSignal[]): Promise<RealtimeBlockOutput | null> {
    const session = await redis.getSession(sessionId);
    if (!session) return null;

    const context = await this.buildContext(sessionId, session);

    // ─── 原有 Agent 并行执行（向后兼容） ─────────────────────────────────────
    const [starResult, competencyResult] = await Promise.all([
      starAgent.execute(context),
      competencyAgent.execute(context),
    ]);

    const scoreResult = await scoringAgent.execute(context);

    if (starResult.success && starResult.data.completeness < 0.6) {
      await followupAgent.execute(context);
    }

    // ─── Module 2: 实时推理循环注入 ─────────────────────────────────────────
    const currentScores = this.sessionScores.get(sessionId) || {
      leadership: 5, communication: 5, execution: 5, ownership: 5, stress_resistance: 5,
    };

    const elapsed = session.startedAt
      ? Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000)
      : 0;

    // 构建 Module 2 实时推理提示词
    const realtimePrompt = buildRealtimeLoopPrompt({
      currentTranscript: context.transcript.split('\n').slice(-10).join('\n'), // 最近10行
      visualSignals: visualSignals || [],
      currentQuestionIdx: session.currentQuestionIdx,
      accumulatedScores: currentScores,
      elapsedSeconds: elapsed,
    });

    // 发布实时推理事件（由 Realtime Loop Agent 处理并返回 5 Block 输出）
    const blockOutput = await this.executeRealtimeInference(sessionId, session.tenantId, realtimePrompt, visualSignals || []);

    // 更新累积评分
    if (blockOutput) {
      for (const score of blockOutput.block3_competency_scores) {
        const dim = score.dimension as CompetencyDimension;
        if (currentScores[dim] !== undefined) {
          currentScores[dim] = score.score;
        }
      }
      this.sessionScores.set(sessionId, currentScores);

      // 累积时间线事件
      const timeline = this.sessionTimeline.get(sessionId) || [];
      for (const event of blockOutput.block5_timeline_events) {
        timeline.push({
          type: event.type,
          timestampSec: event.timestampSec,
          description: event.description,
          videoAnchor: event.jumpToVideo,
        });
      }
      this.sessionTimeline.set(sessionId, timeline);

      // 累积追问历史
      const followUps = this.sessionFollowUps.get(sessionId) || [];
      for (const fu of blockOutput.block2_followup_queue) {
        followUps.push({
          tier: fu.tier,
          question: fu.question,
          triggerReason: fu.triggerReason,
        });
      }
      this.sessionFollowUps.set(sessionId, followUps);

      // WebSocket 推送 5 Block 输出至前端
      eventBus.publish({
        type: 'interview:realtime_blocks',
        sessionId,
        tenantId: session.tenantId,
        timestamp: new Date().toISOString(),
        data: blockOutput,
      });
    }

    // Update session timer
    if (session.startedAt) {
      await redis.updateSession(sessionId, { elapsedSeconds: elapsed });
      
      eventBus.publish({
        type: 'interview:timer_update',
        sessionId,
        tenantId: session.tenantId,
        timestamp: new Date().toISOString(),
        data: { elapsed, total: session.totalQuestions },
      });
    }

    return blockOutput;
  }

  // ─── Question Management ───────────────────────────────────────────────────

  async advanceQuestion(sessionId: string): Promise<InterviewQuestion | null> {
    const session = await redis.getSession(sessionId);
    if (!session) return null;

    const nextIdx = session.currentQuestionIdx + 1;
    if (nextIdx >= session.totalQuestions) return null;

    await redis.updateSession(sessionId, { currentQuestionIdx: nextIdx });
    return session.questions[nextIdx] || null;
  }

  async getCurrentQuestion(sessionId: string): Promise<InterviewQuestion | null> {
    const session = await redis.getSession(sessionId);
    if (!session) return null;
    return session.questions[session.currentQuestionIdx] || null;
  }

  // ─── Module 2: Realtime Inference Execution ────────────────────────────────

  private async executeRealtimeInference(
    sessionId: string,
    tenantId: string,
    realtimePrompt: string,
    visualSignals: CameraVisualSignal[],
  ): Promise<RealtimeBlockOutput | null> {
    try {
      // 获取基座提示词
      const basePrompt = this.sessionPromptCache.get(sessionId) || BASE_SYSTEM_PROMPT;

      // 通过事件总线触发实时推理（由专门的 Realtime Agent 执行 LLM 调用）
      eventBus.publish({
        type: 'interview:realtime_inference_request',
        sessionId,
        tenantId,
        timestamp: new Date().toISOString(),
        data: {
          baseSystemPrompt: basePrompt,
          realtimeLoopPrompt: realtimePrompt,
          outputSchema: REALTIME_OUTPUT_SCHEMA,
          visualSignalCount: visualSignals.length,
        },
      });

      // 注：实际生产中此处通过 await eventBus.request() 或 Agent 直接调用获取结果
      // Demo 模式下返回结构化占位，前端通过 WebSocket 接收实际 Agent 输出
      return null;
    } catch (error) {
      console.error(`[Orchestrator] Realtime inference failed for session ${sessionId}:`, error);
      return null;
    }
  }

  // ─── Module 3: Report Generation Event ─────────────────────────────────────

  private async publishReportGenerationEvent(
    sessionId: string,
    tenantId: string,
    reportPrompt: string,
    reportContext: ReportGenerationContext,
  ): Promise<void> {
    eventBus.publish({
      type: 'interview:report_generation_request',
      sessionId,
      tenantId,
      timestamp: new Date().toISOString(),
      data: {
        reportPrompt,
        outputSchema: REPORT_OUTPUT_SCHEMA,
        context: {
          totalDuration: reportContext.totalDurationSeconds,
          questionsCompleted: reportContext.coreQuestionsCompleted,
          timelineEventCount: reportContext.timelineEvents.length,
          followUpCount: reportContext.followUpHistory.length,
        },
      },
    });
  }

  // ─── Context Builder ───────────────────────────────────────────────────────

  private async buildContext(sessionId: string, session: InterviewSessionData): Promise<AgentContext> {
    const transcript = await redis.getTranscript(sessionId);
    const currentQuestion = session.questions[session.currentQuestionIdx];

    return {
      sessionId,
      tenantId: session.tenantId,
      candidateId: session.candidateId,
      positionId: session.positionId,
      transcript: transcript.map(t => `[${t.speaker}] ${t.text}`).join('\n'),
      currentQuestion: currentQuestion?.text,
      competencies: session.questions
        .map(q => q.competency)
        .filter((v, i, a) => a.indexOf(v) === i), // unique
    };
  }

  // ─── Session Query ─────────────────────────────────────────────────────────

  async getSessionState(sessionId: string) {
    const session = await redis.getSession(sessionId);
    if (!session) return null;

    const scores = await redis.getScores(sessionId);
    const transcript = await redis.getTranscript(sessionId);
    const realtimeScores = this.sessionScores.get(sessionId);
    const timeline = this.sessionTimeline.get(sessionId);

    return {
      ...session,
      scores: realtimeScores || scores,
      transcriptCount: transcript.length,
      lastTranscript: transcript.slice(-5),
      timelineEventCount: timeline?.length || 0,
      promptModulesLoaded: {
        module1_base: this.sessionPromptCache.has(sessionId),
        module2_realtime: session.status === 'in_progress',
        module3_report: session.status === 'completed',
      },
    };
  }

  // ─── Prompt System Info (for debugging/audit) ──────────────────────────────

  getPromptSystemStatus(sessionId: string) {
    return {
      basePromptLoaded: this.sessionPromptCache.has(sessionId),
      basePromptTokenEstimate: this.sessionPromptCache.has(sessionId) ? '~1,200' : '0',
      realtimeLoopTokenEstimate: '~2,800 per cycle',
      reportGenerationTokenEstimate: '~1,500 one-shot',
      coreQuestionBank: CORE_QUESTION_BANK.map(q => ({ id: q.id, text: q.text })),
      outputSchema: 'REALTIME_OUTPUT_SCHEMA (5 blocks)',
    };
  }
}

export const interviewOrchestrator = new InterviewOrchestrator();
