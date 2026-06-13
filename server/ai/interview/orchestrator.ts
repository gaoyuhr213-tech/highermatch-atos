/**
 * 蓉才通™ ATOS — Interview Session Orchestrator
 * 
 * 面试会话的核心编排器，协调所有Agent：
 * 1. 接收音频流 → 触发Whisper Worker
 * 2. 转写完成 → 并行触发STAR + Competency Agent
 * 3. Agent结果 → 触发Scoring Agent
 * 4. 评分完成 → 触发Follow-up Agent（如需追问）
 * 5. 面试结束 → 触发Summary Agent
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
}

export class InterviewOrchestrator {
  
  // ─── Session Lifecycle ───────────────────────────────────────────────────────

  async createSession(input: CreateSessionInput): Promise<InterviewSessionData> {
    const sessionId = `int_${input.tenantId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const session: InterviewSessionData = {
      sessionId,
      tenantId: input.tenantId,
      candidateId: input.candidateId,
      positionId: input.positionId,
      interviewerId: input.interviewerId,
      status: 'waiting',
      startedAt: '',
      currentQuestionIdx: 0,
      totalQuestions: input.questions.length,
      elapsedSeconds: 0,
      questions: input.questions,
    };

    await redis.createSession(sessionId, session);
    return session;
  }

  async startSession(sessionId: string): Promise<void> {
    await redis.updateSession(sessionId, {
      status: 'in_progress',
      startedAt: new Date().toISOString(),
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

    // Trigger summary generation
    const context = await this.buildContext(sessionId, session);
    const report = await summaryAgent.execute(context);

    if (report.success) {
      eventBus.publish({
        type: 'interview:completed',
        sessionId,
        tenantId: session.tenantId,
        timestamp: new Date().toISOString(),
        data: { report: report.data },
      });
    }
  }

  async cancelSession(sessionId: string): Promise<void> {
    await redis.updateSession(sessionId, { status: 'cancelled' });
  }

  // ─── Audio Processing ──────────────────────────────────────────────────────

  async processAudioChunk(input: AudioChunkInput): Promise<void> {
    const session = await redis.getSession(input.sessionId);
    if (!session || session.status !== 'in_progress') {
      throw new Error(`Session ${input.sessionId} is not active`);
    }

    // Enqueue Whisper transcription
    await enqueue('whisper', {
      sessionId: input.sessionId,
      tenantId: session.tenantId,
      audioUrl: input.audioUrl,
      format: input.format,
      chunkIndex: input.chunkIndex,
    });
  }

  // ─── Transcript Processing (called after Whisper completes) ────────────────

  async onTranscriptReady(sessionId: string): Promise<void> {
    const session = await redis.getSession(sessionId);
    if (!session) return;

    const context = await this.buildContext(sessionId, session);

    // Run agents in parallel
    const [starResult, competencyResult] = await Promise.all([
      starAgent.execute(context),
      competencyAgent.execute(context),
    ]);

    // Score based on accumulated data
    const scoreResult = await scoringAgent.execute(context);

    // Determine if follow-up is needed
    if (starResult.success && starResult.data.completeness < 0.6) {
      await followupAgent.execute(context);
    }

    // Update session timer
    if (session.startedAt) {
      const elapsed = Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000);
      await redis.updateSession(sessionId, { elapsedSeconds: elapsed });
      
      eventBus.publish({
        type: 'interview:timer_update',
        sessionId,
        tenantId: session.tenantId,
        timestamp: new Date().toISOString(),
        data: { elapsed, total: session.totalQuestions },
      });
    }
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

    return {
      ...session,
      scores,
      transcriptCount: transcript.length,
      lastTranscript: transcript.slice(-5),
    };
  }
}

export const interviewOrchestrator = new InterviewOrchestrator();
