/**
 * 蓉才通™ ATOS — Salary Intelligence Agent
 * 
 * 薪酬分析引擎：
 * - 市场薪酬基准对标
 * - 薪酬谈判策略
 * - 总包拆解（base + bonus + equity + benefits）
 * - 城市/行业/级别交叉分析
 * - Offer对比评估
 */

import { llm, type LLMMessage } from '../../shared/llm/client';
import { SALARY_ANALYSIS_PROMPT } from '../prompts/salary';

export interface SalaryQueryInput {
  role: string;
  level: string;
  location: string;
  industry: string;
  experienceYears: number;
  skills?: string[];
  currentSalary?: number;
  offers?: OfferPackage[];
  language: 'zh' | 'en';
}

export interface OfferPackage {
  company: string;
  baseSalary: number;
  bonus?: number;
  equity?: { type: string; value: number; vestingYears: number };
  benefits?: string[];
  otherComp?: number;
}

export interface SalaryAnalysis {
  marketBenchmark: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    currency: string;
    dataSource: string;
    sampleSize: string;
  };
  candidatePosition: {
    percentile: number;
    assessment: 'below_market' | 'at_market' | 'above_market' | 'significantly_above';
    gap: number;
  };
  totalCompBreakdown: {
    baseSalary: { range: { min: number; max: number }; typical: number };
    bonus: { range: { min: number; max: number }; typical: number };
    equity: { range: { min: number; max: number }; typical: number };
    totalPackage: { range: { min: number; max: number }; typical: number };
  };
  negotiationStrategy?: {
    targetAsk: number;
    walkawayNumber: number;
    leveragePoints: string[];
    tactics: string[];
    timing: string;
  };
  offerComparison?: OfferComparison[];
  trends: string[];
}

export interface OfferComparison {
  company: string;
  totalComp: number;
  rank: number;
  pros: string[];
  cons: string[];
  recommendation: string;
}

export class SalaryAgent {
  readonly name = 'salary-agent';

  async analyze(input: SalaryQueryInput): Promise<SalaryAnalysis> {
    const messages: LLMMessage[] = [
      { role: 'system', content: SALARY_ANALYSIS_PROMPT },
      {
        role: 'user',
        content: `Analyze salary for:
Role: ${input.role}
Level: ${input.level}
Location: ${input.location}
Industry: ${input.industry}
Experience: ${input.experienceYears} years
Skills: ${input.skills?.join(', ') || 'N/A'}
Current salary: ${input.currentSalary || 'Not provided'}
Offers to compare: ${input.offers ? JSON.stringify(input.offers) : 'None'}
Language: ${input.language === 'zh' ? 'Chinese' : 'English'}

Return comprehensive salary analysis JSON.`,
      },
    ];

    const response = await llm.complete({
      messages,
      model: 'gpt-4o',
      temperature: 0.2,
      max_tokens: 3500,
      response_format: { type: 'json_object' },
      metadata: { tenantId: 'system', agentName: this.name },
    });

    return JSON.parse(response.content) as SalaryAnalysis;
  }
}

export const salaryAgent = new SalaryAgent();
