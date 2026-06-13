/**
 * 蓉才通™ ATOS — Resume Intelligence API Service
 * 
 * 封装 /api/v2/resume/* REST API 调用：
 * - 简历解析（Parser Agent）
 * - 技能提取（Skill Agent）
 * - 风险检测（Risk Agent）
 * - 候选人排名（Ranking Agent）
 * - 推荐解释（Explain Agent）
 * - 人才图谱（Talent Graph）
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api/v2';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ParsedResume {
  id: string;
  candidateId: string;
  basics: {
    name: string;
    email: string;
    phone: string;
    location: string;
    summary: string;
    linkedIn?: string;
    github?: string;
  };
  experience: WorkExperience[];
  education: Education[];
  skills: SkillEntry[];
  certifications: Certification[];
  languages: Language[];
  totalYearsExperience: number;
  seniorityLevel: 'intern' | 'junior' | 'mid' | 'senior' | 'lead' | 'executive';
  parsedAt: string;
  confidence: number;
}

export interface WorkExperience {
  company: string;
  title: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description: string;
  achievements: string[];
  skills: string[];
  industry: string;
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  gpa?: number;
}

export interface SkillEntry {
  name: string;
  category: 'technical' | 'soft' | 'domain' | 'tool';
  proficiency: 'expert' | 'advanced' | 'intermediate' | 'beginner';
  yearsUsed: number;
  lastUsed: string;
  verified: boolean;
  endorsements: number;
}

export interface Certification {
  name: string;
  issuer: string;
  date: string;
  expiryDate?: string;
  credentialId?: string;
}

export interface Language {
  name: string;
  proficiency: 'native' | 'fluent' | 'professional' | 'conversational' | 'basic';
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  riskScore: number; // 0-100
  flags: RiskFlag[];
  recommendations: string[];
}

export interface RiskFlag {
  type: 'gap' | 'inconsistency' | 'embellishment' | 'job_hopping' | 'stagnation' | 'credential_mismatch';
  severity: 'low' | 'medium' | 'high';
  description: string;
  evidence: string;
  suggestion: string;
}

export interface CandidateRanking {
  candidateId: string;
  name: string;
  overallScore: number;
  matchScore: number;
  dimensions: Array<{
    name: string;
    score: number;
    weight: number;
  }>;
  rank: number;
  highlights: string[];
  gaps: string[];
}

export interface RankingExplanation {
  candidateId: string;
  positionId: string;
  overallExplanation: string;
  dimensionExplanations: Array<{
    dimension: string;
    score: number;
    reasoning: string;
    evidence: string[];
  }>;
  comparisonToIdeal: string;
  improvementSuggestions: string[];
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

// ─── Resume Intelligence APIs ────────────────────────────────────────────────

export const resumeService = {
  /** 上传并解析简历 */
  parse: async (file: File, positionId?: string): Promise<{ resume: ParsedResume; jobId: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    if (positionId) formData.append('positionId', positionId);

    const response = await fetch(`${API_BASE}/resume/parse`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error(`Parse failed: ${response.status}`);
    return response.json();
  },

  /** 获取解析结果 */
  getResume: (resumeId: string): Promise<{ resume: ParsedResume }> =>
    apiCall(`/resume/${resumeId}`),

  /** 技能分析 */
  analyzeSkills: (resumeId: string, positionId?: string): Promise<{
    skills: SkillEntry[];
    skillGaps: string[];
    recommendations: string[];
    matchScore: number;
  }> =>
    apiCall(`/resume/${resumeId}/skills`, {
      method: 'POST',
      body: JSON.stringify({ positionId }),
    }),

  /** 风险检测 */
  assessRisk: (resumeId: string): Promise<{ assessment: RiskAssessment }> =>
    apiCall(`/resume/${resumeId}/risk`, { method: 'POST' }),

  /** 候选人排名 */
  rankCandidates: (positionId: string, candidateIds: string[]): Promise<{
    rankings: CandidateRanking[];
    methodology: string;
  }> =>
    apiCall('/resume/rank', {
      method: 'POST',
      body: JSON.stringify({ positionId, candidateIds }),
    }),

  /** 排名解释 */
  explainRanking: (candidateId: string, positionId: string): Promise<{
    explanation: RankingExplanation;
  }> =>
    apiCall('/resume/explain', {
      method: 'POST',
      body: JSON.stringify({ candidateId, positionId }),
    }),

  /** 批量解析 */
  batchParse: async (files: File[], positionId?: string): Promise<{
    jobIds: string[];
    estimatedTime_seconds: number;
  }> => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    if (positionId) formData.append('positionId', positionId);

    const response = await fetch(`${API_BASE}/resume/batch-parse`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error(`Batch parse failed: ${response.status}`);
    return response.json();
  },

  /** 获取解析任务状态 */
  getJobStatus: (jobId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    result?: ParsedResume;
    error?: string;
  }> =>
    apiCall(`/resume/jobs/${jobId}`),
};
