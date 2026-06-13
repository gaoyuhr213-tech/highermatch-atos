/**
 * 蓉才通™ ATOS — Outreach Agent
 * 
 * 智能外联引擎：
 * - 个性化邮件生成（基于候选人画像）
 * - 多轮跟进序列
 * - A/B测试变体
 * - 语气/风格适配
 * - 回复率优化
 */

import { llm, type LLMMessage } from '../../shared/llm/client';
import { OUTREACH_EMAIL_PROMPT, FOLLOWUP_EMAIL_PROMPT } from '../prompts/outreach';

export interface OutreachInput {
  candidateProfile: {
    name: string;
    currentTitle: string;
    currentCompany: string;
    skills: string[];
    experienceYears: number;
    recentAchievements?: string[];
  };
  position: {
    title: string;
    company: string;
    highlights: string[];
    compensation?: string;
  };
  senderProfile: {
    name: string;
    title: string;
    company: string;
  };
  tone: 'professional' | 'casual' | 'executive' | 'technical';
  language: 'zh' | 'en';
  sequenceStep: number; // 1 = initial, 2+ = follow-up
}

export interface OutreachResult {
  subject: string;
  body: string;
  variants: EmailVariant[];
  personalizationPoints: string[];
  estimatedReplyRate: number; // 0-1
  sendTiming: string; // e.g., "Tuesday 10am"
  followupDelay: string; // e.g., "3 days"
}

export interface EmailVariant {
  id: string;
  subject: string;
  body: string;
  approach: 'value_prop' | 'mutual_connection' | 'achievement_hook' | 'curiosity';
}

export class OutreachAgent {
  readonly name = 'outreach-agent';

  async generateEmail(input: OutreachInput): Promise<OutreachResult> {
    const prompt = input.sequenceStep === 1 ? OUTREACH_EMAIL_PROMPT : FOLLOWUP_EMAIL_PROMPT;

    const messages: LLMMessage[] = [
      { role: 'system', content: prompt },
      {
        role: 'user',
        content: `Generate outreach email.

Candidate: ${input.candidateProfile.name}, ${input.candidateProfile.currentTitle} at ${input.candidateProfile.currentCompany}
Skills: ${input.candidateProfile.skills.join(', ')}
Experience: ${input.candidateProfile.experienceYears} years
Recent achievements: ${input.candidateProfile.recentAchievements?.join('; ') || 'N/A'}

Position: ${input.position.title} at ${input.position.company}
Highlights: ${input.position.highlights.join(', ')}
Compensation: ${input.position.compensation || 'Competitive'}

Sender: ${input.senderProfile.name}, ${input.senderProfile.title} at ${input.senderProfile.company}
Tone: ${input.tone}
Language: ${input.language === 'zh' ? 'Chinese (Mandarin)' : 'English'}
Sequence step: ${input.sequenceStep}

Return JSON with subject, body, variants, personalizationPoints, estimatedReplyRate, sendTiming, followupDelay.`,
      },
    ];

    const response = await llm.complete({
      messages,
      model: 'gpt-4o',
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
      metadata: { tenantId: 'system', agentName: this.name },
    });

    return JSON.parse(response.content) as OutreachResult;
  }

  /**
   * Generate a complete outreach sequence (3-5 emails)
   */
  async generateSequence(input: Omit<OutreachInput, 'sequenceStep'>, steps: number = 4): Promise<OutreachResult[]> {
    const sequence: OutreachResult[] = [];
    for (let i = 1; i <= steps; i++) {
      const result = await this.generateEmail({ ...input, sequenceStep: i });
      sequence.push(result);
    }
    return sequence;
  }
}

export const outreachAgent = new OutreachAgent();
