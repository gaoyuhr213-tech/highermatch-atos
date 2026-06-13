/**
 * 蓉才通™ ATOS — STAR Agent
 * 
 * 实时识别候选人回答中的STAR结构：
 * - Situation（情境）
 * - Task（任务）
 * - Action（行动）
 * - Result（结果）
 * 
 * 输出：
 * - 各维度是否覆盖
 * - 覆盖质量评分
 * - 缺失维度提示（供Follow-up Agent使用）
 */

import { InterviewAgent, type AgentContext, type AgentResult } from './base';
import { STAR_ANALYSIS_PROMPT } from '../prompts/star';

export interface STARAnalysis {
  situation: STARDimension;
  task: STARDimension;
  action: STARDimension;
  result: STARDimension;
  overallScore: number; // 0-100
  completeness: number; // 0-1, percentage of dimensions covered
  missingDimensions: string[];
  suggestedFollowup?: string;
  evidence: string[];
}

export interface STARDimension {
  detected: boolean;
  content: string;
  quality: 'excellent' | 'good' | 'partial' | 'missing';
  score: number; // 0-25
  keywords: string[];
}

export class STARAgent extends InterviewAgent {
  readonly name = 'star-agent';
  readonly description = 'Identifies STAR structure in candidate responses';

  async execute(context: AgentContext): Promise<AgentResult<STARAnalysis>> {
    const startTime = Date.now();

    // Get recent transcript for analysis
    const recentTranscript = context.transcript;
    if (!recentTranscript || recentTranscript.length < 50) {
      return {
        success: true,
        data: this.emptyAnalysis(),
        confidence: 0,
        latency_ms: Date.now() - startTime,
      };
    }

    const messages = [
      { role: 'system' as const, content: STAR_ANALYSIS_PROMPT },
      {
        role: 'user' as const,
        content: `Question asked: ${context.currentQuestion || 'N/A'}

Candidate's response:
${recentTranscript}

Analyze the STAR structure in this response. Return JSON.`,
      },
    ];

    const response = await this.callLLM(messages, {
      model: 'gpt-4o-mini',
      temperature: 0.2,
      jsonMode: true,
    });

    const analysis = this.parseJSON<STARAnalysis>(response.content);
    if (!analysis) {
      return {
        success: false,
        data: this.emptyAnalysis(),
        confidence: 0,
        reasoning: 'Failed to parse STAR analysis',
        latency_ms: Date.now() - startTime,
      };
    }

    // Publish event if STAR detected
    if (analysis.completeness > 0.5) {
      this.publishEvent('interview:star_detected', context.sessionId, context.tenantId, {
        analysis,
        questionContext: context.currentQuestion,
      });
    }

    // Cache for follow-up agent
    await this.setMemory(`star:${context.sessionId}`, analysis, 3600);

    return {
      success: true,
      data: analysis,
      confidence: analysis.completeness,
      latency_ms: Date.now() - startTime,
    };
  }

  private emptyAnalysis(): STARAnalysis {
    const emptyDimension: STARDimension = {
      detected: false,
      content: '',
      quality: 'missing',
      score: 0,
      keywords: [],
    };
    return {
      situation: { ...emptyDimension },
      task: { ...emptyDimension },
      action: { ...emptyDimension },
      result: { ...emptyDimension },
      overallScore: 0,
      completeness: 0,
      missingDimensions: ['situation', 'task', 'action', 'result'],
      evidence: [],
    };
  }
}

export const starAgent = new STARAgent();
