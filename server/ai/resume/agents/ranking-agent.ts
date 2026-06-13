/**
 * 蓉才通™ ATOS — Candidate Ranking Agent
 * 
 * 多维度候选人排序：
 * - 技能匹配度
 * - 经验相关度
 * - 文化契合度
 * - 风险评估
 * - 成长潜力
 * 
 * 输出：排序列表 + 每个候选人的排名理由
 */

import { llm, type LLMMessage } from '../../shared/llm/client';
import { RANKING_PROMPT } from '../prompts/ranking';

export interface RankingInput {
  positionId: string;
  jdTitle: string;
  jdRequirements: string[];
  candidates: CandidateProfile[];
  weights?: RankingWeights;
}

export interface CandidateProfile {
  candidateId: string;
  name: string;
  skillScore: number;
  riskLevel: string;
  experienceYears: number;
  currentTitle: string;
  summary: string;
}

export interface RankingWeights {
  skillMatch: number;
  experienceRelevance: number;
  cultureFit: number;
  riskLevel: number;
  growthPotential: number;
}

export interface RankingResult {
  rankings: CandidateRank[];
  methodology: string;
  confidenceLevel: number;
}

export interface CandidateRank {
  candidateId: string;
  rank: number;
  overallScore: number;
  dimensions: {
    skillMatch: number;
    experienceRelevance: number;
    cultureFit: number;
    riskAdjustment: number;
    growthPotential: number;
  };
  reasoning: string;
  highlights: string[];
  concerns: string[];
}

export class RankingAgent {
  readonly name = 'ranking-agent';

  async rank(input: RankingInput): Promise<RankingResult> {
    const weights = input.weights || {
      skillMatch: 0.35,
      experienceRelevance: 0.25,
      cultureFit: 0.15,
      riskLevel: 0.10,
      growthPotential: 0.15,
    };

    const messages: LLMMessage[] = [
      { role: 'system', content: RANKING_PROMPT },
      {
        role: 'user',
        content: `Position: ${input.jdTitle}
Requirements: ${input.jdRequirements.join(', ')}
Weights: ${JSON.stringify(weights)}

Candidates:
${input.candidates.map((c, i) => `${i + 1}. ${c.name} | ${c.currentTitle} | ${c.experienceYears}yr | Skill: ${c.skillScore} | Risk: ${c.riskLevel} | Summary: ${c.summary}`).join('\n')}

Rank all candidates. Return JSON.`,
      },
    ];

    const response = await llm.complete({
      messages,
      model: 'gpt-4o',
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      metadata: { tenantId: 'system', agentName: this.name },
    });

    return JSON.parse(response.content) as RankingResult;
  }
}

export const rankingAgent = new RankingAgent();
