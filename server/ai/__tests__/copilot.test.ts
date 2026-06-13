/**
 * 蓉才通™ ATOS — Candidate Copilot Integration Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockInterviewAgent } from '../copilot/agents/mock-interview-agent';
import { ResumeRewriteAgent } from '../copilot/agents/resume-rewrite-agent';
import { SalaryAgent } from '../copilot/agents/salary-agent';

// Mock LLM client
vi.mock('../shared/llm/client', () => ({
  llm: {
    complete: vi.fn(),
  },
}));

describe('Mock Interview Agent', () => {
  let agent: MockInterviewAgent;

  beforeEach(() => {
    agent = new MockInterviewAgent();
    vi.clearAllMocks();

    const { llm } = require('../shared/llm/client');
    llm.complete.mockResolvedValue({
      content: JSON.stringify({
        questions: [
          {
            id: 'q1',
            question: 'Tell me about a time you had to make a difficult decision with incomplete information.',
            type: 'behavioral',
            competency: 'Decision Making',
            difficulty: 'medium',
            hints: ['Think about a time with ambiguity', 'Focus on your process'],
            idealAnswerStructure: 'STAR format with emphasis on reasoning process',
          },
          {
            id: 'q2',
            question: 'How would you design a system to handle 10M daily active users?',
            type: 'technical',
            competency: 'System Design',
            difficulty: 'hard',
            hints: ['Start with requirements', 'Consider scaling strategies'],
            idealAnswerStructure: 'Requirements → High-level design → Deep dive → Trade-offs',
          },
        ],
      }),
      model: 'gpt-4o',
      usage: { prompt_tokens: 200, completion_tokens: 400, total_tokens: 600 },
    });
  });

  it('should generate questions matching config', async () => {
    const questions = await agent.generateQuestions({
      targetPosition: 'Senior Software Engineer',
      interviewType: 'mixed',
      difficulty: 'medium',
      language: 'en',
    }, 2);

    expect(questions.length).toBe(2);
    expect(questions[0].competency).toBeTruthy();
    expect(questions[0].hints.length).toBeGreaterThan(0);
  });

  it('should evaluate answers with feedback', async () => {
    const { llm } = require('../shared/llm/client');
    llm.complete.mockResolvedValue({
      content: JSON.stringify({
        score: 75,
        strengths: ['Good structure', 'Specific example'],
        improvements: ['Quantify the result', 'Add more detail on your specific role'],
        modelAnswer: 'A strong answer would include...',
        starAnalysis: { situation: true, task: true, action: true, result: false },
      }),
      model: 'gpt-4o',
      usage: { prompt_tokens: 300, completion_tokens: 250, total_tokens: 550 },
    });

    const feedback = await agent.evaluateAnswer(
      'Tell me about a leadership challenge',
      'I led a team through a product launch...',
      { targetPosition: 'PM', interviewType: 'behavioral', difficulty: 'medium', language: 'en' }
    );

    expect(feedback.score).toBeGreaterThanOrEqual(0);
    expect(feedback.score).toBeLessThanOrEqual(100);
    expect(feedback.strengths.length).toBeGreaterThan(0);
    expect(feedback.improvements.length).toBeGreaterThan(0);
  });
});

describe('Resume Rewrite Agent', () => {
  let agent: ResumeRewriteAgent;

  beforeEach(() => {
    agent = new ResumeRewriteAgent();
    vi.clearAllMocks();

    const { llm } = require('../shared/llm/client');
    llm.complete.mockResolvedValue({
      content: JSON.stringify({
        rewrittenResume: 'Optimized resume content...',
        changes: [
          { section: 'Experience', original: 'Worked on projects', rewritten: 'Led 3 cross-functional projects delivering $2M revenue', reason: 'Quantified and action-verb', impact: 'high' },
        ],
        atsScore: { before: 45, after: 82 },
        keywords: { added: ['cross-functional', 'revenue'], emphasized: ['leadership', 'delivery'] },
        suggestions: ['Add metrics to education section'],
        wordCount: { before: 350, after: 380 },
      }),
      model: 'gpt-4o',
      usage: { prompt_tokens: 500, completion_tokens: 600, total_tokens: 1100 },
    });
  });

  it('should improve ATS score', async () => {
    const result = await agent.rewrite({
      originalResume: 'Worked on projects at company...',
      targetPosition: 'Senior PM',
      language: 'en',
    });

    expect(result.atsScore.after).toBeGreaterThan(result.atsScore.before);
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.keywords.added.length).toBeGreaterThan(0);
  });
});

describe('Salary Agent', () => {
  let agent: SalaryAgent;

  beforeEach(() => {
    agent = new SalaryAgent();
    vi.clearAllMocks();

    const { llm } = require('../shared/llm/client');
    llm.complete.mockResolvedValue({
      content: JSON.stringify({
        marketBenchmark: { p25: 350000, p50: 500000, p75: 700000, p90: 950000, currency: 'CNY', dataSource: 'Market surveys 2024', sampleSize: '500+' },
        candidatePosition: { percentile: 60, assessment: 'at_market', gap: 0 },
        totalCompBreakdown: {
          baseSalary: { range: { min: 300000, max: 600000 }, typical: 420000 },
          bonus: { range: { min: 30000, max: 120000 }, typical: 60000 },
          equity: { range: { min: 0, max: 200000 }, typical: 50000 },
          totalPackage: { range: { min: 350000, max: 900000 }, typical: 530000 },
        },
        negotiationStrategy: {
          targetAsk: 600000,
          walkawayNumber: 450000,
          leveragePoints: ['Competing offer', 'Specialized skills'],
          tactics: ['Anchor high', 'Focus on total comp'],
          timing: 'After verbal offer, before written',
        },
        trends: ['AI/ML skills command 20-30% premium', 'Remote work expanding compensation bands'],
      }),
      model: 'gpt-4o',
      usage: { prompt_tokens: 300, completion_tokens: 400, total_tokens: 700 },
    });
  });

  it('should provide market benchmark with percentiles', async () => {
    const result = await agent.analyze({
      role: 'Senior Software Engineer',
      level: 'Senior',
      location: '成都',
      industry: 'Internet',
      experienceYears: 8,
      language: 'zh',
    });

    expect(result.marketBenchmark.p50).toBeGreaterThan(0);
    expect(result.marketBenchmark.p75).toBeGreaterThan(result.marketBenchmark.p25);
    expect(result.candidatePosition.assessment).toMatch(/below_market|at_market|above_market|significantly_above/);
  });
});
