/**
 * 蓉才通™ ATOS — Resume Intelligence Integration Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResumeParserAgent } from '../resume/agents/parser-agent';
import { SkillAgent } from '../resume/agents/skill-agent';
import { RiskAgent } from '../resume/agents/risk-agent';

// Mock LLM client
vi.mock('../shared/llm/client', () => ({
  llm: {
    complete: vi.fn(),
  },
}));

describe('Resume Parser Agent', () => {
  let agent: ResumeParserAgent;

  beforeEach(() => {
    agent = new ResumeParserAgent();
    vi.clearAllMocks();

    const { llm } = require('../shared/llm/client');
    llm.complete.mockResolvedValue({
      content: JSON.stringify({
        name: '张三',
        email: 'zhangsan@example.com',
        phone: '13800138000',
        currentTitle: '高级软件工程师',
        currentCompany: '字节跳动',
        location: '成都',
        experienceYears: 8,
        education: [{ degree: '硕士', major: '计算机科学', university: '电子科技大学', year: 2016 }],
        experience: [
          { title: '高级工程师', company: '字节跳动', duration: '2020-至今', highlights: ['Led 5-person team', 'Built recommendation system'] },
          { title: '工程师', company: '腾讯', duration: '2016-2020', highlights: ['Developed payment module'] },
        ],
        skills: { technical: ['Python', 'Go', 'Kubernetes', 'ML'], soft: ['Leadership', 'Communication'] },
        summary: '8年经验的全栈工程师，专注推荐系统和分布式架构',
        languages: ['中文', 'English'],
        certifications: ['AWS Solutions Architect'],
      }),
      model: 'gpt-4o',
      usage: { prompt_tokens: 500, completion_tokens: 400, total_tokens: 900 },
    });
  });

  it('should parse resume text into structured data', async () => {
    const resumeText = `张三 | 高级软件工程师 | 字节跳动
    zhangsan@example.com | 13800138000 | 成都
    教育: 电子科技大学 计算机科学硕士 2016
    经验: 字节跳动 高级工程师 2020-至今
    技能: Python, Go, Kubernetes, ML`;

    const result = await agent.parse(resumeText, 'cand_001');
    expect(result.name).toBe('张三');
    expect(result.skills.technical).toContain('Python');
    expect(result.experienceYears).toBe(8);
  });
});

describe('Skill Agent', () => {
  let agent: SkillAgent;

  beforeEach(() => {
    agent = new SkillAgent();
    vi.clearAllMocks();

    const { llm } = require('../shared/llm/client');
    llm.complete.mockResolvedValue({
      content: JSON.stringify({
        skills: [
          { name: 'Python', level: 'expert', yearsUsed: 8, evidence: 'Primary language at ByteDance', category: 'programming' },
          { name: 'Kubernetes', level: 'advanced', yearsUsed: 4, evidence: 'Managed production clusters', category: 'infrastructure' },
          { name: 'Machine Learning', level: 'intermediate', yearsUsed: 3, evidence: 'Built recommendation system', category: 'ai_ml' },
        ],
        skillGaps: ['System Design at scale', 'Team management'],
        recommendations: ['Consider AWS ML Specialty certification'],
        overallLevel: 'senior',
      }),
      model: 'gpt-4o',
      usage: { prompt_tokens: 300, completion_tokens: 250, total_tokens: 550 },
    });
  });

  it('should analyze skills with proficiency levels', async () => {
    const result = await agent.analyze('Python expert, Kubernetes, ML experience', ['Python', 'Go', 'Kubernetes']);
    expect(result.skills.length).toBeGreaterThan(0);
    expect(result.skills[0].level).toMatch(/beginner|intermediate|advanced|expert/);
    expect(result.overallLevel).toBeTruthy();
  });
});

describe('Risk Agent', () => {
  let agent: RiskAgent;

  beforeEach(() => {
    agent = new RiskAgent();
    vi.clearAllMocks();

    const { llm } = require('../shared/llm/client');
    llm.complete.mockResolvedValue({
      content: JSON.stringify({
        overallRisk: 'low',
        riskScore: 15,
        flags: [],
        positiveSignals: ['Stable career progression', 'Increasing responsibility', 'Quantified achievements'],
        concerns: [],
        recommendation: 'proceed',
        explanation: 'Strong candidate with stable career trajectory and clear growth',
      }),
      model: 'gpt-4o',
      usage: { prompt_tokens: 400, completion_tokens: 200, total_tokens: 600 },
    });
  });

  it('should assess risk level for a stable candidate', async () => {
    const parsedResume = { experienceYears: 8, experience: [{ duration: '4 years' }, { duration: '4 years' }] };
    const result = await agent.assess('Full resume text here', parsedResume);
    expect(result.overallRisk).toBe('low');
    expect(result.riskScore).toBeLessThan(30);
    expect(result.recommendation).toBe('proceed');
  });
});
