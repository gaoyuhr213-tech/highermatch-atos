/**
 * 蓉才通™ ATOS — Explain Agent (XAI)
 * 
 * 为每个AI决策提供可解释性输出：
 * - 为什么推荐/不推荐这个候选人
 * - 评分依据是什么
 * - 哪些因素权重最高
 * - 与其他候选人的差异化分析
 * 
 * 对标：Eightfold AI的"Talent Intelligence"可解释性
 */

import { llm, type LLMMessage } from '../../shared/llm/client';
import { EXPLAIN_PROMPT } from '../prompts/explain';

export interface ExplanationRequest {
  candidateId: string;
  positionId: string;
  decision: string;
  scores: Record<string, number>;
  context: {
    skillAnalysis?: unknown;
    riskAssessment?: unknown;
    rankPosition?: number;
    totalCandidates?: number;
  };
}

export interface Explanation {
  summary: string; // 1-2句话总结
  factors: ExplanationFactor[];
  comparison: string; // 与同批候选人对比
  confidence: number;
  limitations: string[]; // 分析局限性声明
  suggestedActions: string[];
}

export interface ExplanationFactor {
  factor: string;
  impact: 'strongly_positive' | 'positive' | 'neutral' | 'negative' | 'strongly_negative';
  weight: number;
  evidence: string;
  humanReadable: string; // 面向HR的自然语言解释
}

export class ExplainAgent {
  readonly name = 'explain-agent';

  async explain(request: ExplanationRequest): Promise<Explanation> {
    const messages: LLMMessage[] = [
      { role: 'system', content: EXPLAIN_PROMPT },
      {
        role: 'user',
        content: `Generate explanation for the following AI decision:

Candidate: ${request.candidateId}
Position: ${request.positionId}
Decision: ${request.decision}
Scores: ${JSON.stringify(request.scores)}
Context: ${JSON.stringify(request.context)}

Provide a clear, HR-friendly explanation. Return JSON.`,
      },
    ];

    const response = await llm.complete({
      messages,
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      metadata: { tenantId: 'system', agentName: this.name },
    });

    return JSON.parse(response.content) as Explanation;
  }
}

export const explainAgent = new ExplainAgent();
