/**
 * 蓉才通™ ATOS — PeopleGPT API Service
 * 
 * 封装 /api/v2/people/* REST API 调用：
 * - 自然语言人才搜索（Search Agent）
 * - 候选人排名（Ranking Agent）
 * - 外联邮件生成（Outreach Agent）
 * - 人才图谱查询
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api/v2';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PeopleSearchRequest {
  query: string; // Natural language query
  filters?: {
    location?: string;
    experienceMin?: number;
    experienceMax?: number;
    skills?: string[];
    education?: string;
    industry?: string;
    currentCompany?: string;
    seniorityLevel?: string;
  };
  maxResults?: number;
  includeExplanation?: boolean;
}

export interface PeopleSearchResult {
  candidates: SearchedCandidate[];
  total: number;
  queryInterpretation: string;
  searchStrategy: string;
  executionTime_ms: number;
}

export interface SearchedCandidate {
  id: string;
  name: string;
  title: string;
  company: string;
  location: string;
  experience_years: number;
  skills: string[];
  matchScore: number;
  matchReasons: string[];
  availability: 'active' | 'passive' | 'not_looking' | 'unknown';
  lastActive?: string;
  profileSummary: string;
}

export interface OutreachRequest {
  candidateId: string;
  positionId: string;
  tone: 'formal' | 'casual' | 'enthusiastic';
  channel: 'email' | 'linkedin' | 'wechat';
  senderName: string;
  senderTitle: string;
  companyName: string;
  customContext?: string;
}

export interface OutreachResult {
  subject: string;
  body: string;
  callToAction: string;
  personalizationPoints: string[];
  estimatedResponseRate: number;
  alternatives: Array<{
    subject: string;
    body: string;
    tone: string;
  }>;
}

export interface TalentGraphNode {
  id: string;
  type: 'candidate' | 'company' | 'skill' | 'position' | 'school';
  label: string;
  metadata: Record<string, unknown>;
}

export interface TalentGraphEdge {
  source: string;
  target: string;
  type: 'worked_at' | 'has_skill' | 'studied_at' | 'knows' | 'applied_to';
  weight: number;
  metadata?: Record<string, unknown>;
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

// ─── PeopleGPT APIs ──────────────────────────────────────────────────────────

export const peopleService = {
  /** 自然语言人才搜索 */
  search: (request: PeopleSearchRequest): Promise<PeopleSearchResult> =>
    apiCall('/people/search', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /** 获取候选人详情 */
  getCandidate: (candidateId: string): Promise<{ candidate: SearchedCandidate & { fullProfile: unknown } }> =>
    apiCall(`/people/candidates/${candidateId}`),

  /** 生成外联邮件 */
  generateOutreach: (request: OutreachRequest): Promise<{ outreach: OutreachResult }> =>
    apiCall('/people/outreach', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /** 批量外联 */
  batchOutreach: (requests: OutreachRequest[]): Promise<{
    results: Array<{ candidateId: string; outreach: OutreachResult }>;
    estimatedTime_seconds: number;
  }> =>
    apiCall('/people/outreach/batch', {
      method: 'POST',
      body: JSON.stringify({ requests }),
    }),

  /** 人才图谱查询 */
  queryGraph: (params: {
    centerNodeId: string;
    depth?: number;
    types?: string[];
  }): Promise<{
    nodes: TalentGraphNode[];
    edges: TalentGraphEdge[];
  }> =>
    apiCall('/people/graph', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  /** 相似候选人推荐 */
  findSimilar: (candidateId: string, limit?: number): Promise<{
    candidates: SearchedCandidate[];
    methodology: string;
  }> =>
    apiCall(`/people/candidates/${candidateId}/similar?limit=${limit || 10}`),

  /** 保存搜索 */
  saveSearch: (name: string, request: PeopleSearchRequest): Promise<{ searchId: string }> =>
    apiCall('/people/searches', {
      method: 'POST',
      body: JSON.stringify({ name, ...request }),
    }),
};
