/**
 * 蓉才通™ ATOS — Skill Extraction & Matching Agent
 * 
 * 功能：
 * - 从简历中提取技能图谱
 * - 与JD要求进行匹配
 * - 识别技能差距
 * - 推断隐含技能
 */

import { llm, type LLMMessage } from '../../shared/llm/client';
import { SKILL_EXTRACTION_PROMPT } from '../prompts/skill';

export interface SkillAnalysis {
  extractedSkills: ExtractedSkill[];
  matchedSkills: SkillMatch[];
  missingSkills: string[];
  inferredSkills: InferredSkill[];
  skillScore: number; // 0-100
  skillGapSeverity: 'none' | 'minor' | 'moderate' | 'severe';
}

export interface ExtractedSkill {
  name: string;
  category: string;
  proficiency: string;
  evidence: string;
  recency: 'current' | 'recent' | 'dated' | 'unknown';
}

export interface SkillMatch {
  required: string;
  candidate: string;
  matchType: 'exact' | 'equivalent' | 'partial' | 'transferable';
  confidence: number;
}

export interface InferredSkill {
  skill: string;
  inferredFrom: string;
  confidence: number;
  reasoning: string;
}

export class SkillAgent {
  readonly name = 'skill-agent';

  async analyze(resumeText: string, jdRequirements: string[]): Promise<SkillAnalysis> {
    const messages: LLMMessage[] = [
      { role: 'system', content: SKILL_EXTRACTION_PROMPT },
      {
        role: 'user',
        content: `Resume:\n${resumeText}\n\nJob Requirements:\n${jdRequirements.join('\n')}\n\nAnalyze skill match. Return JSON.`,
      },
    ];

    const response = await llm.complete({
      messages,
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
      metadata: { tenantId: 'system', agentName: this.name },
    });

    return JSON.parse(response.content) as SkillAnalysis;
  }
}

export const skillAgent = new SkillAgent();
