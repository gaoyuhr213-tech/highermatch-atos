/**
 * 蓉才通™ ATOS — Summary Agent
 * 
 * 面试结束后自动生成结构化面试报告：
 * - Executive Summary
 * - 能力评估矩阵
 * - STAR案例摘要
 * - 风险信号
 * - 录用建议
 * - 对比基准
 * 
 * 输出格式：interview_report（JSON + Markdown双格式）
 */

import { InterviewAgent, type AgentContext, type AgentResult } from './base';
import { redis } from '../../shared/memory/redis';
import { SUMMARY_PROMPT } from '../prompts/summary';

export interface InterviewReport {
  reportId: string;
  sessionId: string;
  candidateId: string;
  positionId: string;
  generatedAt: string;
  duration_minutes: number;
  
  executiveSummary: string;
  
  competencyMatrix: CompetencyMatrixEntry[];
  
  starCases: STARCase[];
  
  keyStrengths: string[];
  developmentAreas: string[];
  riskSignals: RiskSignal[];
  
  recommendation: {
    decision: 'strong_hire' | 'hire' | 'lean_hire' | 'lean_no_hire' | 'no_hire';
    confidence: number;
    reasoning: string;
    nextSteps: string[];
  };
  
  interviewerNotes?: string;
  
  metadata: {
    totalQuestions: number;
    totalFollowups: number;
    avgResponseTime_seconds: number;
    transcriptWordCount: number;
    modelUsed: string;
  };
}

export interface CompetencyMatrixEntry {
  competency: string;
  score: number;
  level: string;
  keyEvidence: string;
  behavioralExamples: string[];
}

export interface STARCase {
  question: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  quality: 'excellent' | 'good' | 'partial' | 'weak';
  competencyDemonstrated: string[];
}

export interface RiskSignal {
  type: 'inconsistency' | 'gap' | 'red_flag' | 'concern';
  description: string;
  severity: 'high' | 'medium' | 'low';
  evidence: string;
}

export class SummaryAgent extends InterviewAgent {
  readonly name = 'summary-agent';
  readonly description = 'Generates comprehensive interview reports';

  async execute(context: AgentContext): Promise<AgentResult<InterviewReport>> {
    const startTime = Date.now();

    // Gather all data from the session
    const session = await redis.getSession(context.sessionId);
    const transcript = await redis.getTranscript(context.sessionId);
    const scores = await redis.getScores(context.sessionId);
    const starData = await this.getMemory<unknown>(`star:${context.sessionId}`);
    const competencySignals = await this.getMemory<unknown>(`signals:${context.sessionId}`);

    const messages = [
      { role: 'system' as const, content: SUMMARY_PROMPT },
      {
        role: 'user' as const,
        content: `Generate a comprehensive interview report.

Position competencies: ${context.competencies.join(', ')}

Session data:
- Duration: ${session?.elapsedSeconds ? Math.round(session.elapsedSeconds / 60) : 0} minutes
- Questions asked: ${session?.totalQuestions || 0}
- Status: ${session?.status || 'completed'}

Full transcript:
${transcript.map(t => `[${t.speaker}] ${t.text}`).join('\n')}

Accumulated scores: ${JSON.stringify(scores)}

STAR analyses: ${JSON.stringify(starData || {})}

Competency signals: ${JSON.stringify(competencySignals || [])}

Return a complete interview_report JSON.`,
      },
    ];

    const response = await this.callLLM(messages, {
      model: 'gpt-4o',
      temperature: 0.2,
      maxTokens: 4096,
      jsonMode: true,
    });

    const report = this.parseJSON<InterviewReport>(response.content);
    if (!report) {
      return {
        success: false,
        data: this.emptyReport(context),
        confidence: 0,
        reasoning: 'Failed to generate report',
        latency_ms: Date.now() - startTime,
      };
    }

    // Enrich with metadata
    report.reportId = `rpt_${context.sessionId}_${Date.now()}`;
    report.sessionId = context.sessionId;
    report.candidateId = context.candidateId;
    report.positionId = context.positionId;
    report.generatedAt = new Date().toISOString();
    report.metadata = {
      totalQuestions: session?.totalQuestions || 0,
      totalFollowups: 0,
      avgResponseTime_seconds: 0,
      transcriptWordCount: transcript.reduce((sum, t) => sum + t.text.split(' ').length, 0),
      modelUsed: 'gpt-4o',
    };

    // Publish completion event
    this.publishEvent('interview:completed', context.sessionId, context.tenantId, {
      reportId: report.reportId,
      recommendation: report.recommendation.decision,
      overallScore: scores.overall || 0,
    });

    return {
      success: true,
      data: report,
      confidence: 0.9,
      latency_ms: Date.now() - startTime,
    };
  }

  private emptyReport(context: AgentContext): InterviewReport {
    return {
      reportId: '',
      sessionId: context.sessionId,
      candidateId: context.candidateId,
      positionId: context.positionId,
      generatedAt: new Date().toISOString(),
      duration_minutes: 0,
      executiveSummary: 'Report generation failed',
      competencyMatrix: [],
      starCases: [],
      keyStrengths: [],
      developmentAreas: [],
      riskSignals: [],
      recommendation: {
        decision: 'lean_no_hire',
        confidence: 0,
        reasoning: 'Insufficient data',
        nextSteps: [],
      },
      metadata: {
        totalQuestions: 0,
        totalFollowups: 0,
        avgResponseTime_seconds: 0,
        transcriptWordCount: 0,
        modelUsed: 'gpt-4o',
      },
    };
  }
}

export const summaryAgent = new SummaryAgent();
