/**
 * 蓉才通™ ATOS — Learning Roadmap Agent
 * 
 * 个性化学习路径生成：
 * - 基于技能差距生成学习计划
 * - 推荐课程/书籍/项目
 * - 时间线规划
 * - 里程碑设定
 * - 进度追踪建议
 */

import { llm, type LLMMessage } from '../../shared/llm/client';
import { LEARNING_ROADMAP_PROMPT } from '../prompts/learning';

export interface LearningInput {
  currentSkills: string[];
  targetSkills: string[];
  targetRole: string;
  availableHoursPerWeek: number;
  learningStyle: 'visual' | 'reading' | 'hands_on' | 'mixed';
  budget?: string;
  timeline?: string;
  language: 'zh' | 'en';
}

export interface LearningRoadmap {
  overview: string;
  totalDuration: string;
  phases: LearningPhase[];
  resources: LearningResource[];
  milestones: Milestone[];
  weeklySchedule: WeeklyBlock[];
  estimatedCost: string;
  successMetrics: string[];
}

export interface LearningPhase {
  id: string;
  name: string;
  duration: string;
  skills: string[];
  objectives: string[];
  deliverables: string[];
  resources: string[];
}

export interface LearningResource {
  name: string;
  type: 'course' | 'book' | 'project' | 'certification' | 'community' | 'mentor';
  url?: string;
  platform?: string;
  cost: string;
  duration: string;
  priority: 'must_do' | 'recommended' | 'optional';
  skillsCovered: string[];
}

export interface Milestone {
  week: number;
  title: string;
  criteria: string;
  deliverable: string;
}

export interface WeeklyBlock {
  day: string;
  hours: number;
  activity: string;
  resource: string;
}

export class LearningRoadmapAgent {
  readonly name = 'learning-roadmap-agent';

  async generate(input: LearningInput): Promise<LearningRoadmap> {
    const messages: LLMMessage[] = [
      { role: 'system', content: LEARNING_ROADMAP_PROMPT },
      {
        role: 'user',
        content: `Generate personalized learning roadmap.

Current skills: ${input.currentSkills.join(', ')}
Target skills: ${input.targetSkills.join(', ')}
Target role: ${input.targetRole}
Available time: ${input.availableHoursPerWeek} hours/week
Learning style: ${input.learningStyle}
Budget: ${input.budget || 'Flexible'}
Timeline: ${input.timeline || 'As fast as possible'}
Language: ${input.language === 'zh' ? 'Chinese' : 'English'}

Return comprehensive learning roadmap JSON.`,
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

    return JSON.parse(response.content) as LearningRoadmap;
  }
}

export const learningRoadmapAgent = new LearningRoadmapAgent();
