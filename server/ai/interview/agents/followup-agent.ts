/**
 * 蓉才通™ ATOS — Follow-up Agent
 * 
 * 根据候选人回答自动生成追问：
 * - 基于STAR缺失维度追问
 * - 基于能力信号不足追问
 * - 基于逻辑漏洞追问
 * - 基于深度不足追问
 * 
 * 追问策略：
 * 1. Clarification — 澄清模糊表述
 * 2. Depth — 深入具体细节
 * 3. Challenge — 挑战性追问（压力测试）
 * 4. Pivot — 转向新维度
 */

import { InterviewAgent, type AgentContext, type AgentResult } from './base';
import { FOLLOWUP_GENERATION_PROMPT } from '../prompts/followup';
import type { STARAnalysis } from './star-agent';

export interface FollowupResult {
  question: string;
  strategy: 'clarification' | 'depth' | 'challenge' | 'pivot';
  targetCompetency: string;
  reasoning: string;
  priority: number; // 1-5
  alternatives: string[];
}

export class FollowupAgent extends InterviewAgent {
  readonly name = 'followup-agent';
  readonly description = 'Generates intelligent follow-up questions based on candidate responses';

  async execute(context: AgentContext): Promise<AgentResult<FollowupResult>> {
    const startTime = Date.now();

    // Get STAR analysis from memory (set by STAR agent)
    const starAnalysis = await this.getMemory<STARAnalysis>(`star:${context.sessionId}`);

    // Get previous questions to avoid repetition
    const askedQuestions = await this.getMemory<string[]>(`asked:${context.sessionId}`) || [];

    const messages = [
      { role: 'system' as const, content: FOLLOWUP_GENERATION_PROMPT },
      {
        role: 'user' as const,
        content: `Current question: ${context.currentQuestion || 'N/A'}

Candidate's latest response:
${context.transcript}

STAR Analysis: ${starAnalysis ? JSON.stringify({
  completeness: starAnalysis.completeness,
  missingDimensions: starAnalysis.missingDimensions,
  overallScore: starAnalysis.overallScore,
}) : 'Not available'}

Target competencies: ${context.competencies.join(', ')}

Previously asked questions (avoid repetition):
${askedQuestions.slice(-5).map((q, i) => `${i + 1}. ${q}`).join('\n')}

Generate the best follow-up question. Return JSON.`,
      },
    ];

    const response = await this.callLLM(messages, {
      model: 'gpt-4o',
      temperature: 0.5,
      maxTokens: 1500,
      jsonMode: true,
    });

    const result = this.parseJSON<FollowupResult>(response.content);
    if (!result) {
      return {
        success: false,
        data: this.defaultFollowup(),
        confidence: 0,
        reasoning: 'Failed to generate follow-up',
        latency_ms: Date.now() - startTime,
      };
    }

    // Track asked questions
    askedQuestions.push(result.question);
    await this.setMemory(`asked:${context.sessionId}`, askedQuestions, 7200);

    // Publish follow-up event
    this.publishEvent('interview:followup', context.sessionId, context.tenantId, {
      question: result.question,
      strategy: result.strategy,
      targetCompetency: result.targetCompetency,
    });

    return {
      success: true,
      data: result,
      confidence: 0.85,
      latency_ms: Date.now() - startTime,
    };
  }

  private defaultFollowup(): FollowupResult {
    return {
      question: '能否详细描述一下你在这个过程中具体做了什么？',
      strategy: 'depth',
      targetCompetency: 'Execution',
      reasoning: 'Default fallback question',
      priority: 3,
      alternatives: [],
    };
  }
}

export const followupAgent = new FollowupAgent();
