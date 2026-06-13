/**
 * 蓉才通™ ATOS — AI Interview OS Integration Tests
 * 
 * Test Strategy:
 * - Unit tests for each agent (mocked LLM)
 * - Integration tests for orchestrator flow
 * - E2E tests for API endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { STARAgent } from '../interview/agents/star-agent';
import { CompetencyAgent } from '../interview/agents/competency-agent';
import { FollowupAgent } from '../interview/agents/followup-agent';
import { ScoringAgent } from '../interview/agents/scoring-agent';
import type { AgentContext } from '../interview/agents/base';

// Mock LLM client
vi.mock('../shared/llm/client', () => ({
  llm: {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        situation: { detected: true, content: 'Led a team of 10', quality: 'good', score: 20, keywords: ['team', 'led'] },
        task: { detected: true, content: 'Deliver new product', quality: 'good', score: 18, keywords: ['product', 'deliver'] },
        action: { detected: true, content: 'Implemented agile', quality: 'excellent', score: 23, keywords: ['agile', 'implemented'] },
        result: { detected: true, content: '30% revenue increase', quality: 'excellent', score: 25, keywords: ['30%', 'revenue'] },
        overallScore: 86,
        completeness: 1.0,
        missingDimensions: [],
        suggestedFollowup: null,
        evidence: ['Led a team of 10', '30% revenue increase'],
      }),
      model: 'gpt-4o-mini',
      usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
    }),
  },
}));

// Mock Redis
vi.mock('../shared/memory/redis', () => ({
  redis: {
    getAgentMemory: vi.fn().mockResolvedValue(null),
    setAgentMemory: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn().mockResolvedValue(null),
    getTranscript: vi.fn().mockResolvedValue([]),
    getScores: vi.fn().mockResolvedValue({}),
    updateScores: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock Event Bus
vi.mock('../shared/events/bus', () => ({
  eventBus: {
    publish: vi.fn(),
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

const mockContext: AgentContext = {
  sessionId: 'test_session_001',
  tenantId: 'tenant_001',
  candidateId: 'cand_001',
  positionId: 'pos_001',
  transcript: `I led a team of 10 engineers to deliver a new product feature. 
We were facing tight deadlines and I implemented agile methodology to improve our velocity.
The result was a 30% increase in revenue within the first quarter.`,
  currentQuestion: 'Tell me about a time you led a team through a challenging project.',
  competencies: ['Leadership', 'Execution', 'Communication'],
};

describe('STAR Agent', () => {
  let agent: STARAgent;

  beforeEach(() => {
    agent = new STARAgent();
    vi.clearAllMocks();
  });

  it('should detect STAR structure in a well-formed response', async () => {
    const result = await agent.execute(mockContext);

    expect(result.success).toBe(true);
    expect(result.data.overallScore).toBeGreaterThan(0);
    expect(result.data.completeness).toBeGreaterThan(0);
    expect(result.data.situation.detected).toBe(true);
    expect(result.data.action.detected).toBe(true);
    expect(result.data.result.detected).toBe(true);
  });

  it('should return empty analysis for short responses', async () => {
    const shortContext = { ...mockContext, transcript: 'Yes.' };
    const result = await agent.execute(shortContext);

    expect(result.success).toBe(true);
    expect(result.data.completeness).toBe(0);
    expect(result.confidence).toBe(0);
  });
});

describe('Competency Agent', () => {
  let agent: CompetencyAgent;

  beforeEach(() => {
    agent = new CompetencyAgent();
    vi.clearAllMocks();

    // Override mock for competency response
    const { llm } = require('../shared/llm/client');
    llm.complete.mockResolvedValue({
      content: JSON.stringify({
        competencies: [
          { name: 'Leadership', score: 85, level: 'strong', evidence: ['Led team of 10'], behavioralIndicators: ['delegation'] },
          { name: 'Execution', score: 78, level: 'strong', evidence: ['30% revenue'], behavioralIndicators: ['results-driven'] },
        ],
        overallProfile: 'Strong leader with execution focus',
        strengths: ['Team leadership', 'Results orientation'],
        developmentAreas: ['Communication clarity'],
        cultureFit: 82,
        signals: [{ competency: 'Leadership', type: 'positive', text: 'Led team of 10', timestamp: new Date().toISOString(), weight: 0.9 }],
      }),
      model: 'gpt-4o',
      usage: { prompt_tokens: 200, completion_tokens: 300, total_tokens: 500 },
    });
  });

  it('should assess competencies from transcript', async () => {
    const result = await agent.execute(mockContext);

    expect(result.success).toBe(true);
    expect(result.data.competencies.length).toBeGreaterThan(0);
    expect(result.data.cultureFit).toBeGreaterThan(0);
  });
});

describe('Scoring Agent', () => {
  let agent: ScoringAgent;

  beforeEach(() => {
    agent = new ScoringAgent();
    vi.clearAllMocks();

    const { llm } = require('../shared/llm/client');
    llm.complete.mockResolvedValue({
      content: JSON.stringify({
        overall: 82,
        dimensions: [
          { name: 'Leadership', score: 85, weight: 0.3, evidence: 'Led team of 10' },
          { name: 'Execution', score: 80, weight: 0.3, evidence: '30% revenue increase' },
          { name: 'Communication', score: 75, weight: 0.2, evidence: 'Clear articulation' },
        ],
        recommendation: 'hire',
        confidence: 0.85,
        reasoning: 'Strong leadership and execution skills demonstrated',
        highlights: ['Team leadership', 'Quantified results'],
        concerns: ['Limited communication examples'],
      }),
      model: 'gpt-4o',
      usage: { prompt_tokens: 300, completion_tokens: 200, total_tokens: 500 },
    });
  });

  it('should produce calibrated scores', async () => {
    const result = await agent.execute(mockContext);

    expect(result.success).toBe(true);
    expect(result.data.overall).toBeGreaterThanOrEqual(0);
    expect(result.data.overall).toBeLessThanOrEqual(100);
    expect(result.data.recommendation).toMatch(/hire|no_hire/);
    expect(result.data.dimensions.length).toBeGreaterThan(0);
  });
});

describe('Follow-up Agent', () => {
  let agent: FollowupAgent;

  beforeEach(() => {
    agent = new FollowupAgent();
    vi.clearAllMocks();

    const { llm } = require('../shared/llm/client');
    llm.complete.mockResolvedValue({
      content: JSON.stringify({
        question: '你能具体描述一下在实施敏捷方法时遇到的最大阻力是什么吗？',
        strategy: 'depth',
        targetCompetency: 'Leadership',
        reasoning: 'Candidate mentioned implementing agile but did not describe challenges faced',
        priority: 4,
        alternatives: ['团队中有没有人反对这个变化？你是如何处理的？'],
      }),
      model: 'gpt-4o',
      usage: { prompt_tokens: 250, completion_tokens: 150, total_tokens: 400 },
    });
  });

  it('should generate relevant follow-up questions', async () => {
    const result = await agent.execute(mockContext);

    expect(result.success).toBe(true);
    expect(result.data.question).toBeTruthy();
    expect(result.data.strategy).toMatch(/clarification|depth|challenge|pivot/);
    expect(result.data.targetCompetency).toBeTruthy();
  });
});
