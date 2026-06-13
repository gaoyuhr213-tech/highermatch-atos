/**
 * 蓉才通™ ATOS — Career Planner Agent
 * 
 * 职业规划引擎：
 * - 基于当前画像生成职业路径
 * - 短期（6个月）/ 中期（2年）/ 长期（5年）规划
 * - 技能差距分析
 * - 行业趋势匹配
 * - 转型可行性评估
 */

import { llm, type LLMMessage } from '../../shared/llm/client';
import { CAREER_PLAN_PROMPT } from '../prompts/career';

export interface CareerPlanInput {
  currentProfile: {
    title: string;
    company: string;
    industry: string;
    experienceYears: number;
    skills: string[];
    education: string;
    salary?: number;
  };
  aspirations: {
    targetRole?: string;
    targetIndustry?: string;
    priorities: ('salary' | 'growth' | 'worklife' | 'impact' | 'leadership')[];
    constraints?: string[];
  };
  language: 'zh' | 'en';
}

export interface CareerPlan {
  currentAssessment: {
    strengths: string[];
    gaps: string[];
    marketPosition: string;
    competitiveness: number; // 0-100
  };
  paths: CareerPath[];
  shortTermActions: ActionItem[]; // 0-6 months
  mediumTermActions: ActionItem[]; // 6-24 months
  longTermVision: string;
  riskFactors: string[];
  industryTrends: string[];
}

export interface CareerPath {
  id: string;
  name: string;
  targetRole: string;
  timeline: string;
  feasibility: number; // 0-100
  salaryRange: { min: number; max: number; currency: string };
  requiredSkills: string[];
  milestones: string[];
  pros: string[];
  cons: string[];
}

export interface ActionItem {
  action: string;
  category: 'skill' | 'network' | 'project' | 'certification' | 'education' | 'job_search';
  priority: 'critical' | 'important' | 'nice_to_have';
  timeline: string;
  resources?: string[];
  measurableOutcome: string;
}

export class CareerPlannerAgent {
  readonly name = 'career-planner-agent';

  async generatePlan(input: CareerPlanInput): Promise<CareerPlan> {
    const messages: LLMMessage[] = [
      { role: 'system', content: CAREER_PLAN_PROMPT },
      {
        role: 'user',
        content: `Generate career plan.

Current: ${input.currentProfile.title} at ${input.currentProfile.company} (${input.currentProfile.industry})
Experience: ${input.currentProfile.experienceYears} years
Skills: ${input.currentProfile.skills.join(', ')}
Education: ${input.currentProfile.education}

Aspirations: Target ${input.aspirations.targetRole || 'growth'} in ${input.aspirations.targetIndustry || 'current industry'}
Priorities: ${input.aspirations.priorities.join(', ')}
Constraints: ${input.aspirations.constraints?.join(', ') || 'None'}
Language: ${input.language === 'zh' ? 'Chinese' : 'English'}

Return comprehensive career plan JSON.`,
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

    return JSON.parse(response.content) as CareerPlan;
  }
}

export const careerPlannerAgent = new CareerPlannerAgent();
