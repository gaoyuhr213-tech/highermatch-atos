/**
 * 蓉才通™ ATOS — Resume Risk Detection Agent
 * 
 * 识别简历中的风险信号：
 * - 频繁跳槽（<1年/份）
 * - 职业空窗期（>6个月）
 * - 学历造假信号
 * - 经历不一致
 * - 过度包装
 * - 降级跳槽
 */

import { llm, type LLMMessage } from '../../shared/llm/client';
import { RISK_DETECTION_PROMPT } from '../prompts/risk';

export interface RiskAssessment {
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number; // 0-100, higher = more risky
  signals: RiskSignal[];
  recommendations: string[];
  verificationNeeded: VerificationItem[];
}

export interface RiskSignal {
  type: 'job_hopping' | 'employment_gap' | 'inconsistency' | 'overstatement' | 'downgrade' | 'education_concern' | 'other';
  severity: 'low' | 'medium' | 'high';
  description: string;
  evidence: string;
  period?: string;
  mitigatingFactors?: string;
}

export interface VerificationItem {
  item: string;
  type: 'education' | 'employment' | 'certification' | 'achievement';
  priority: 'must_verify' | 'should_verify' | 'nice_to_verify';
  method: string;
}

export class RiskAgent {
  readonly name = 'risk-agent';

  async assess(resumeText: string, parsedData?: unknown): Promise<RiskAssessment> {
    const messages: LLMMessage[] = [
      { role: 'system', content: RISK_DETECTION_PROMPT },
      {
        role: 'user',
        content: `Analyze the following resume for risk signals:\n\n${resumeText}\n\n${parsedData ? `Structured data: ${JSON.stringify(parsedData)}` : ''}\n\nReturn risk assessment JSON.`,
      },
    ];

    const response = await llm.complete({
      messages,
      model: 'gpt-4o',
      temperature: 0.1,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
      metadata: { tenantId: 'system', agentName: this.name },
    });

    return JSON.parse(response.content) as RiskAssessment;
  }
}

export const riskAgent = new RiskAgent();
