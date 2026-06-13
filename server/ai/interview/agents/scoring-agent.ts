/**
 * 蓉才通™ ATOS — Scoring Agent
 * 
 * 实时评分引擎：
 * - 综合STAR分析 + 能力评估 + 语言质量
 * - 输出多维度分数
 * - 支持权重自定义（按岗位）
 * - 生成评分理由（可解释性）
 */

import { InterviewAgent, type AgentContext, type AgentResult } from './base';
import { redis } from '../../shared/memory/redis';
import { SCORING_PROMPT } from '../prompts/scoring';

export interface InterviewScore {
  overall: number; // 0-100
  dimensions: ScoreDimension[];
  recommendation: 'strong_hire' | 'hire' | 'lean_hire' | 'lean_no_hire' | 'no_hire';
  confidence: number; // 0-1
  reasoning: string;
  highlights: string[];
  concerns: string[];
  comparisonBenchmark?: string; // e.g., "Top 20% of candidates for this role"
}

export interface ScoreDimension {
  name: string;
  score: number; // 0-100
  weight: number; // 0-1, must sum to 1
  evidence: string;
}

export class ScoringAgent extends InterviewAgent {
  readonly name = 'scoring-agent';
  readonly description = 'Real-time interview scoring with multi-dimensional assessment';

  async execute(context: AgentContext): Promise<AgentResult<InterviewScore>> {
    const startTime = Date.now();

    // Gather all agent outputs from memory
    const starData = await this.getMemory<unknown>(`star:${context.sessionId}`);
    const competencySignals = await this.getMemory<unknown>(`signals:${context.sessionId}`);

    const messages = [
      { role: 'system' as const, content: SCORING_PROMPT },
      {
        role: 'user' as const,
        content: `Position competencies: ${context.competencies.join(', ')}

Full transcript so far:
${context.transcript}

STAR Analysis data: ${JSON.stringify(starData || {})}

Competency signals: ${JSON.stringify(competencySignals || [])}

Generate comprehensive interview score. Return JSON with: overall, dimensions, recommendation, confidence, reasoning, highlights, concerns.`,
      },
    ];

    const response = await this.callLLM(messages, {
      model: 'gpt-4o',
      temperature: 0.1,
      maxTokens: 2500,
      jsonMode: true,
    });

    const score = this.parseJSON<InterviewScore>(response.content);
    if (!score) {
      return {
        success: false,
        data: this.defaultScore(context.competencies),
        confidence: 0,
        reasoning: 'Failed to generate score',
        latency_ms: Date.now() - startTime,
      };
    }

    // Update real-time scores in Redis
    const scoreMap: Record<string, number> = { overall: score.overall };
    for (const dim of score.dimensions) {
      scoreMap[dim.name] = dim.score;
    }
    await redis.updateScores(context.sessionId, scoreMap);

    // Publish score update
    this.publishEvent('interview:score_update', context.sessionId, context.tenantId, {
      overall: score.overall,
      recommendation: score.recommendation,
      dimensions: score.dimensions.map(d => ({ name: d.name, score: d.score })),
    });

    return {
      success: true,
      data: score,
      confidence: score.confidence,
      latency_ms: Date.now() - startTime,
    };
  }

  private defaultScore(competencies: string[]): InterviewScore {
    return {
      overall: 0,
      dimensions: competencies.map(name => ({
        name,
        score: 0,
        weight: 1 / competencies.length,
        evidence: '',
      })),
      recommendation: 'lean_no_hire',
      confidence: 0,
      reasoning: 'Insufficient data for scoring',
      highlights: [],
      concerns: [],
    };
  }
}

export const scoringAgent = new ScoringAgent();
