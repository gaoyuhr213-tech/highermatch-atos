/**
 * 蓉才通™ ATOS — Resume Rewrite Agent
 * 
 * 简历优化引擎：
 * - 针对目标岗位优化简历内容
 * - STAR方法重写工作经历
 * - 关键词优化（ATS友好）
 * - 量化成就
 * - 多版本输出（不同岗位方向）
 */

import { llm, type LLMMessage } from '../../shared/llm/client';
import { RESUME_REWRITE_PROMPT } from '../prompts/resume-rewrite';

export interface RewriteInput {
  originalResume: string;
  targetPosition?: string;
  targetCompany?: string;
  targetIndustry?: string;
  focusAreas?: string[];
  language: 'zh' | 'en';
}

export interface RewriteResult {
  rewrittenResume: string;
  changes: RewriteChange[];
  atsScore: { before: number; after: number };
  keywords: { added: string[]; emphasized: string[] };
  suggestions: string[];
  wordCount: { before: number; after: number };
}

export interface RewriteChange {
  section: string;
  original: string;
  rewritten: string;
  reason: string;
  impact: 'high' | 'medium' | 'low';
}

export class ResumeRewriteAgent {
  readonly name = 'resume-rewrite-agent';

  async rewrite(input: RewriteInput): Promise<RewriteResult> {
    const messages: LLMMessage[] = [
      { role: 'system', content: RESUME_REWRITE_PROMPT },
      {
        role: 'user',
        content: `Rewrite this resume for the target position.

Original resume:
${input.originalResume}

Target: ${input.targetPosition || 'General improvement'} at ${input.targetCompany || 'any company'}
Industry: ${input.targetIndustry || 'any'}
Focus areas: ${input.focusAreas?.join(', ') || 'overall improvement'}
Language: ${input.language === 'zh' ? 'Chinese' : 'English'}

Return JSON with rewrittenResume, changes, atsScore, keywords, suggestions, wordCount.`,
      },
    ];

    const response = await llm.complete({
      messages,
      model: 'gpt-4o',
      temperature: 0.4,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      metadata: { tenantId: 'system', agentName: this.name },
    });

    return JSON.parse(response.content) as RewriteResult;
  }
}

export const resumeRewriteAgent = new ResumeRewriteAgent();
