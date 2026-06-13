/**
 * 蓉才通™ ATOS — Interview API Service
 * 
 * 封装 /api/v2/interview/* REST API 调用：
 * - 创建/启动/结束面试会话
 * - 获取面试报告
 * - 获取评分历史
 * - 管理面试问题
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api/v2';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreateSessionRequest {
  candidateId: string;
  positionId: string;
  interviewType: 'structured' | 'behavioral' | 'technical' | 'case';
  competencies?: string[];
  duration_minutes?: number;
  language?: string;
}

export interface InterviewSession {
  id: string;
  candidateId: string;
  positionId: string;
  status: 'created' | 'in_progress' | 'completed' | 'cancelled';
  interviewType: string;
  competencies: string[];
  startedAt?: string;
  completedAt?: string;
  duration_minutes: number;
  currentQuestionIndex: number;
  totalQuestions: number;
}

export interface InterviewQuestion {
  id: string;
  text: string;
  category: string;
  competency: string;
  difficulty: 'easy' | 'medium' | 'hard';
  expectedDuration_seconds: number;
  followupCount: number;
}

export interface InterviewReport {
  reportId: string;
  sessionId: string;
  executiveSummary: string;
  overallScore: number;
  recommendation: string;
  competencyMatrix: Array<{
    competency: string;
    score: number;
    level: string;
    evidence: string;
  }>;
  starCases: Array<{
    question: string;
    completeness: number;
    summary: string;
  }>;
  keyStrengths: string[];
  developmentAreas: string[];
  riskSignals: Array<{ type: string; description: string; severity: string }>;
  generatedAt: string;
}

export interface TranscriptSegment {
  id: string;
  timestamp: string;
  speaker: 'candidate' | 'interviewer' | 'system';
  text: string;
  confidence: number;
  starAnalysis?: {
    dimension: string;
    quality: string;
  };
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

// ─── Interview Session APIs ──────────────────────────────────────────────────

export const interviewService = {
  /** 创建面试会话 */
  createSession: (data: CreateSessionRequest): Promise<{ session: InterviewSession }> =>
    apiCall('/interview/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 获取面试会话详情 */
  getSession: (sessionId: string): Promise<{ session: InterviewSession }> =>
    apiCall(`/interview/sessions/${sessionId}`),

  /** 启动面试（开始录音+Agent Pipeline） */
  startSession: (sessionId: string): Promise<{ session: InterviewSession; firstQuestion: InterviewQuestion }> =>
    apiCall(`/interview/sessions/${sessionId}/start`, { method: 'POST' }),

  /** 结束面试 */
  completeSession: (sessionId: string): Promise<{ session: InterviewSession; reportId: string }> =>
    apiCall(`/interview/sessions/${sessionId}/complete`, { method: 'POST' }),

  /** 取消面试 */
  cancelSession: (sessionId: string, reason?: string): Promise<void> =>
    apiCall(`/interview/sessions/${sessionId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  /** 获取当前问题 */
  getCurrentQuestion: (sessionId: string): Promise<{ question: InterviewQuestion }> =>
    apiCall(`/interview/sessions/${sessionId}/question`),

  /** 推进到下一个问题 */
  advanceQuestion: (sessionId: string): Promise<{ question: InterviewQuestion; isLast: boolean }> =>
    apiCall(`/interview/sessions/${sessionId}/advance`, { method: 'POST' }),

  /** 获取面试转写记录 */
  getTranscript: (sessionId: string): Promise<{ segments: TranscriptSegment[] }> =>
    apiCall(`/interview/sessions/${sessionId}/transcript`),

  /** 获取面试报告 */
  getReport: (sessionId: string): Promise<{ report: InterviewReport }> =>
    apiCall(`/interview/sessions/${sessionId}/report`),

  /** 获取面试列表 */
  listSessions: (params?: {
    candidateId?: string;
    positionId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ sessions: InterviewSession[]; total: number }> => {
    const query = new URLSearchParams();
    if (params?.candidateId) query.set('candidateId', params.candidateId);
    if (params?.positionId) query.set('positionId', params.positionId);
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    return apiCall(`/interview/sessions?${query.toString()}`);
  },

  /** 提交音频块（备选：REST方式，主要用WebSocket） */
  submitAudioChunk: async (sessionId: string, audioBlob: Blob, chunkIndex: number): Promise<void> => {
    const formData = new FormData();
    formData.append('audio', audioBlob, `chunk_${chunkIndex}.webm`);
    formData.append('chunkIndex', String(chunkIndex));

    const response = await fetch(`${API_BASE}/interview/sessions/${sessionId}/audio`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Audio upload failed: ${response.status}`);
    }
  },
};
