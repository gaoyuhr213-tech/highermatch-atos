/**
 * 蓉才通™ ATOS — Resume Parser Agent
 * 
 * 简历智能解析：
 * - 支持PDF/DOCX/TXT/图片
 * - 结构化提取：个人信息、教育、工作经历、技能、项目、证书
 * - 多语言支持（中文/英文）
 * - 格式归一化
 */

import { llm, type LLMMessage } from '../../shared/llm/client';
import { RESUME_PARSE_PROMPT } from '../prompts/parse';

export interface ParsedResume {
  candidateId: string;
  parsedAt: string;
  confidence: number;

  personal: {
    name: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
    summary?: string;
  };

  education: EducationEntry[];
  experience: ExperienceEntry[];
  skills: SkillEntry[];
  projects: ProjectEntry[];
  certifications: CertificationEntry[];
  languages: LanguageEntry[];
  
  metadata: {
    totalYearsExperience: number;
    highestDegree: string;
    currentTitle: string;
    currentCompany: string;
    careerLevel: 'intern' | 'junior' | 'mid' | 'senior' | 'lead' | 'director' | 'vp' | 'c_level';
    industryFocus: string[];
    rawTextLength: number;
  };
}

export interface EducationEntry {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  gpa?: string;
  honors?: string[];
  isOverseas: boolean;
}

export interface ExperienceEntry {
  company: string;
  title: string;
  department?: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  location?: string;
  responsibilities: string[];
  achievements: string[];
  technologies?: string[];
}

export interface SkillEntry {
  name: string;
  category: 'technical' | 'soft' | 'domain' | 'tool' | 'language';
  proficiency: 'expert' | 'advanced' | 'intermediate' | 'beginner';
  yearsUsed?: number;
  lastUsed?: string;
  verified: boolean;
}

export interface ProjectEntry {
  name: string;
  role: string;
  description: string;
  technologies: string[];
  outcome?: string;
  startDate?: string;
  endDate?: string;
}

export interface CertificationEntry {
  name: string;
  issuer: string;
  date: string;
  expiryDate?: string;
  credentialId?: string;
}

export interface LanguageEntry {
  language: string;
  proficiency: 'native' | 'fluent' | 'professional' | 'intermediate' | 'basic';
}

export class ResumeParserAgent {
  readonly name = 'resume-parser';

  async parse(rawText: string, candidateId: string): Promise<ParsedResume> {
    const messages: LLMMessage[] = [
      { role: 'system', content: RESUME_PARSE_PROMPT },
      { role: 'user', content: `Parse the following resume into structured JSON:\n\n${rawText}` },
    ];

    const response = await llm.complete({
      messages,
      model: 'gpt-4o',
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      metadata: { tenantId: 'system', agentName: this.name },
    });

    const parsed = JSON.parse(response.content) as Omit<ParsedResume, 'candidateId' | 'parsedAt' | 'confidence'>;

    return {
      ...parsed,
      candidateId,
      parsedAt: new Date().toISOString(),
      confidence: 0.92,
    };
  }
}

export const resumeParserAgent = new ResumeParserAgent();
