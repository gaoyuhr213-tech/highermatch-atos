/**
 * 蓉才通™ ATOS — Competency Agent
 * 
 * 实时评估候选人在以下维度的能力信号：
 * - Leadership（领导力）
 * - Communication（沟通力）
 * - Ownership（主人翁意识）
 * - Execution（执行力）
 * - Stress Resistance（抗压能力）
 * 
 * 支持自定义维度（按岗位JD动态生成）
 */

import { InterviewAgent, type AgentContext, type AgentResult } from './base';
import { COMPETENCY_ANALYSIS_PROMPT } from '../prompts/competency';

export interface CompetencyAssessment {
  competencies: CompetencyScore[];
  overallProfile: string;
  strengths: string[];
  developmentAreas: string[];
  cultureFit: number; // 0-100
  signals: CompetencySignal[];
}

export interface CompetencyScore {
  name: string;
  score: number; // 0-100
  level: 'exceptional' | 'strong' | 'adequate' | 'developing' | 'insufficient';
  evidence: string[];
  behavioralIndicators: string[];
}

export interface CompetencySignal {
  competency: string;
  type: 'positive' | 'negative' | 'neutral';
  text: string;
  timestamp: string;
  weight: number; // 0-1
}

const DEFAULT_COMPETENCIES = [
  'Leadership',
  'Communication',
  'Ownership',
  'Execution',
  'Stress Resistance',
];

export class CompetencyAgent extends InterviewAgent {
  readonly name = 'competency-agent';
  readonly description = 'Real-time competency assessment across multiple dimensions';

  async execute(context: AgentContext): Promise<AgentResult<CompetencyAssessment>> {
    const startTime = Date.now();

    const competencies = context.competencies.length > 0
      ? context.competencies
      : DEFAULT_COMPETENCIES;

    // Get accumulated signals from memory
    const previousSignals = await this.getMemory<CompetencySignal[]>(`signals:${context.sessionId}`) || [];

    const messages = [
      { role: 'system' as const, content: COMPETENCY_ANALYSIS_PROMPT },
      {
        role: 'user' as const,
        content: `Competencies to assess: ${competencies.join(', ')}

Previous signals detected: ${JSON.stringify(previousSignals.slice(-10))}

Current transcript segment:
${context.transcript}

Question context: ${context.currentQuestion || 'General conversation'}

Analyze competency signals. Return JSON with competencies array, overallProfile, strengths, developmentAreas, cultureFit, and new signals.`,
      },
    ];

    const response = await this.callLLM(messages, {
      model: 'gpt-4o',
      temperature: 0.2,
      maxTokens: 3000,
      jsonMode: true,
    });

    const assessment = this.parseJSON<CompetencyAssessment>(response.content);
    if (!assessment) {
      return {
        success: false,
        data: this.emptyAssessment(competencies),
        confidence: 0,
        reasoning: 'Failed to parse competency assessment',
        latency_ms: Date.now() - startTime,
      };
    }

    // Accumulate signals in memory
    const allSignals = [...previousSignals, ...assessment.signals];
    await this.setMemory(`signals:${context.sessionId}`, allSignals, 7200);

    // Publish real-time update
    this.publishEvent('interview:competency_signal', context.sessionId, context.tenantId, {
      competencies: assessment.competencies.map(c => ({ name: c.name, score: c.score, level: c.level })),
      newSignals: assessment.signals,
    });

    return {
      success: true,
      data: assessment,
      confidence: 0.8,
      latency_ms: Date.now() - startTime,
    };
  }

  private emptyAssessment(competencies: string[]): CompetencyAssessment {
    return {
      competencies: competencies.map(name => ({
        name,
        score: 0,
        level: 'insufficient' as const,
        evidence: [],
        behavioralIndicators: [],
      })),
      overallProfile: '',
      strengths: [],
      developmentAreas: [],
      cultureFit: 0,
      signals: [],
    };
  }
}

export const competencyAgent = new CompetencyAgent();
