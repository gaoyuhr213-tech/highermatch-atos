/**
 * 蓉才通™ ATOS — Mock Interview Agent
 * 
 * AI模拟面试官：
 * - 根据目标岗位生成面试题库
 * - 实时评估回答质量
 * - 提供改进建议
 * - 支持多轮对话
 * - 模拟不同面试风格（技术/行为/压力）
 */

import { llm, type LLMMessage } from '../../shared/llm/client';
import { MOCK_INTERVIEW_PROMPT, ANSWER_FEEDBACK_PROMPT } from '../prompts/mock-interview';

export interface MockInterviewConfig {
  targetPosition: string;
  targetCompany?: string;
  interviewType: 'behavioral' | 'technical' | 'case' | 'mixed';
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  language: 'zh' | 'en';
  candidateBackground?: string;
  focusCompetencies?: string[];
}

export interface MockQuestion {
  id: string;
  question: string;
  type: 'behavioral' | 'technical' | 'situational' | 'case';
  competency: string;
  difficulty: string;
  hints: string[];
  idealAnswerStructure: string;
}

export interface AnswerFeedback {
  score: number; // 0-100
  strengths: string[];
  improvements: string[];
  modelAnswer: string;
  starAnalysis?: {
    situation: boolean;
    task: boolean;
    action: boolean;
    result: boolean;
  };
  nextQuestion?: string;
}

export class MockInterviewAgent {
  readonly name = 'mock-interview-agent';

  async generateQuestions(config: MockInterviewConfig, count: number = 10): Promise<MockQuestion[]> {
    const messages: LLMMessage[] = [
      { role: 'system', content: MOCK_INTERVIEW_PROMPT },
      {
        role: 'user',
        content: `Generate ${count} interview questions.

Position: ${config.targetPosition}
Company: ${config.targetCompany || 'General'}
Type: ${config.interviewType}
Difficulty: ${config.difficulty}
Language: ${config.language === 'zh' ? 'Chinese' : 'English'}
Candidate background: ${config.candidateBackground || 'N/A'}
Focus competencies: ${config.focusCompetencies?.join(', ') || 'All'}

Return JSON array of questions with id, question, type, competency, difficulty, hints, idealAnswerStructure.`,
      },
    ];

    const response = await llm.complete({
      messages,
      model: 'gpt-4o',
      temperature: 0.6,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      metadata: { tenantId: 'system', agentName: this.name },
    });

    const parsed = JSON.parse(response.content);
    return parsed.questions || parsed;
  }

  async evaluateAnswer(
    question: string,
    answer: string,
    config: MockInterviewConfig
  ): Promise<AnswerFeedback> {
    const messages: LLMMessage[] = [
      { role: 'system', content: ANSWER_FEEDBACK_PROMPT },
      {
        role: 'user',
        content: `Evaluate this interview answer.

Question: ${question}
Answer: ${answer}
Position: ${config.targetPosition}
Type: ${config.interviewType}
Language: ${config.language === 'zh' ? 'Chinese' : 'English'}

Return JSON with score, strengths, improvements, modelAnswer, starAnalysis.`,
      },
    ];

    const response = await llm.complete({
      messages,
      model: 'gpt-4o',
      temperature: 0.3,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
      metadata: { tenantId: 'system', agentName: this.name },
    });

    return JSON.parse(response.content) as AnswerFeedback;
  }
}

export const mockInterviewAgent = new MockInterviewAgent();
