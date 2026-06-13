/**
 * 蓉才通™ ATOS — Candidate Copilot API Service
 * 
 * 封装 /api/v2/copilot/* REST API 调用：
 * - 简历改写（Resume Rewrite Agent）
 * - 模拟面试（Mock Interview Agent）
 * - 职业规划（Career Planner Agent）
 * - 薪酬分析（Salary Agent）
 * - 学习路线图（Learning Roadmap Agent）
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api/v2';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ResumeRewriteRequest {
  resumeText: string;
  targetPosition?: string;
  targetCompany?: string;
  style: 'professional' | 'creative' | 'executive' | 'technical';
  focusAreas?: string[];
  language?: string;
}

export interface ResumeRewriteResult {
  rewrittenResume: string;
  changes: Array<{
    section: string;
    original: string;
    revised: string;
    reasoning: string;
  }>;
  improvementScore: number; // 0-100
  atsScore: number; // ATS compatibility 0-100
  suggestions: string[];
  keywordsAdded: string[];
}

export interface MockInterviewRequest {
  positionTitle: string;
  company?: string;
  interviewType: 'behavioral' | 'technical' | 'case' | 'mixed';
  difficulty: 'easy' | 'medium' | 'hard';
  duration_minutes: number;
  focusCompetencies?: string[];
}

export interface MockInterviewSession {
  sessionId: string;
  questions: MockQuestion[];
  status: 'active' | 'completed';
}

export interface MockQuestion {
  id: string;
  text: string;
  category: string;
  difficulty: string;
  tips: string[];
  sampleAnswer?: string;
}

export interface MockAnswerFeedback {
  score: number;
  starAnalysis: {
    situation: boolean;
    task: boolean;
    action: boolean;
    result: boolean;
  };
  strengths: string[];
  improvements: string[];
  revisedAnswer: string;
  followupQuestion?: string;
}

export interface CareerPlanRequest {
  currentRole: string;
  currentLevel: string;
  targetRole: string;
  targetTimeline_months: number;
  skills: string[];
  interests: string[];
  constraints?: string[];
}

export interface CareerPlan {
  currentAssessment: string;
  targetAnalysis: string;
  gap: string[];
  milestones: Array<{
    month: number;
    title: string;
    actions: string[];
    metrics: string[];
  }>;
  risks: string[];
  alternativePaths: Array<{
    role: string;
    reasoning: string;
    probability: number;
  }>;
}

export interface SalaryAnalysisRequest {
  role: string;
  level: string;
  location: string;
  yearsExperience: number;
  skills: string[];
  industry?: string;
  companySize?: 'startup' | 'mid' | 'large' | 'enterprise';
}

export interface SalaryAnalysis {
  estimatedRange: {
    low: number;
    median: number;
    high: number;
    currency: string;
  };
  percentile: number;
  factors: Array<{
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    description: string;
  }>;
  negotiationTips: string[];
  marketTrend: 'rising' | 'stable' | 'declining';
  comparisons: Array<{
    company: string;
    range: string;
    notes: string;
  }>;
}

export interface LearningRoadmapRequest {
  currentSkills: string[];
  targetSkills: string[];
  learningStyle: 'self-paced' | 'structured' | 'project-based';
  weeklyHours: number;
  budget?: number;
}

export interface LearningRoadmap {
  totalDuration_weeks: number;
  phases: Array<{
    phase: number;
    title: string;
    duration_weeks: number;
    skills: string[];
    resources: Array<{
      type: 'course' | 'book' | 'project' | 'certification' | 'community';
      name: string;
      url?: string;
      cost?: number;
      duration_hours: number;
      priority: 'required' | 'recommended' | 'optional';
    }>;
    milestones: string[];
    assessment: string;
  }>;
  estimatedCost: number;
  expectedOutcome: string;
}

// ─── API Client ──────────────────────────────────────────────────────────────

async function apiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `API Error: ${response.status}`);
  }

  return response.json();
}

// ─── Copilot APIs ────────────────────────────────────────────────────────────

export const copilotService = {
  // ─── Resume Rewrite ──────────────────────────────────────────────────────

  /** 改写简历 */
  rewriteResume: (request: ResumeRewriteRequest): Promise<{ result: ResumeRewriteResult }> =>
    apiCall('/copilot/resume/rewrite', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  // ─── Mock Interview ──────────────────────────────────────────────────────

  /** 创建模拟面试 */
  createMockInterview: (request: MockInterviewRequest): Promise<{ session: MockInterviewSession }> =>
    apiCall('/copilot/mock-interview/create', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /** 提交回答并获取反馈 */
  submitAnswer: (sessionId: string, questionId: string, answer: string): Promise<{
    feedback: MockAnswerFeedback;
    nextQuestion?: MockQuestion;
  }> =>
    apiCall('/copilot/mock-interview/answer', {
      method: 'POST',
      body: JSON.stringify({ sessionId, questionId, answer }),
    }),

  /** 获取模拟面试报告 */
  getMockReport: (sessionId: string): Promise<{
    overallScore: number;
    feedbacks: MockAnswerFeedback[];
    summary: string;
    improvementPlan: string[];
  }> =>
    apiCall(`/copilot/mock-interview/${sessionId}/report`),

  // ─── Career Planning ─────────────────────────────────────────────────────

  /** 生成职业规划 */
  planCareer: (request: CareerPlanRequest): Promise<{ plan: CareerPlan }> =>
    apiCall('/copilot/career/plan', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  // ─── Salary Analysis ─────────────────────────────────────────────────────

  /** 薪酬分析 */
  analyzeSalary: (request: SalaryAnalysisRequest): Promise<{ analysis: SalaryAnalysis }> =>
    apiCall('/copilot/salary/analyze', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  // ─── Learning Roadmap ────────────────────────────────────────────────────

  /** 生成学习路线图 */
  generateRoadmap: (request: LearningRoadmapRequest): Promise<{ roadmap: LearningRoadmap }> =>
    apiCall('/copilot/learning/roadmap', {
      method: 'POST',
      body: JSON.stringify(request),
    }),
};
