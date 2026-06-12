/**
 * HigherMatch ATOS — API Type Definitions
 * 
 * 所有业务实体类型定义，对齐PRD领域模型
 */

// ─── Common ──────────────────────────────────────────────────────────────────

export type UUID = string;
export type ISODateTime = string;
export type TenantId = string;

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ─── Auth & Identity ─────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'hr_manager' | 'hr_specialist' | 'interviewer' | 'candidate' | 'auditor';

export interface User {
  id: UUID;
  tenantId: TenantId;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar?: string;
  caVerified: boolean;
  caCertSN?: string;
  lastLoginAt: ISODateTime;
  createdAt: ISODateTime;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  type: 'ushield' | 'password' | 'sms';
  // U盾登录
  certSN?: string;
  signature?: string;
  challenge?: string;
  // 密码登录
  username?: string;
  password?: string;
  // 短信登录
  phone?: string;
  code?: string;
}

export interface UShieldChallenge {
  challengeId: string;
  nonce: string;
  timestamp: number;
  expiresAt: number;
}

// ─── Enterprise & Tenant ─────────────────────────────────────────────────────

export type EnterpriseVerifyStatus = 'unverified' | 'pending' | 'verified' | 'rejected' | 'expired';

export interface Enterprise {
  id: UUID;
  tenantId: TenantId;
  name: string;
  unifiedSocialCreditCode: string;
  legalRepresentative: string;
  registeredCapital: string;
  industry: string;
  scale: '1-50' | '50-200' | '200-500' | '500-1000' | '1000+';
  address: string;
  contactPerson: string;
  contactPhone: string;
  caVerifyStatus: EnterpriseVerifyStatus;
  caCertSN?: string;
  caVerifiedAt?: ISODateTime;
  trustScore: number;
  createdAt: ISODateTime;
}

// ─── Job & Position ──────────────────────────────────────────────────────────

export type JobStatus = 'draft' | 'pending_review' | 'active' | 'paused' | 'closed' | 'archived';

export interface Job {
  id: UUID;
  tenantId: TenantId;
  enterpriseId: UUID;
  title: string;
  department: string;
  location: string;
  salaryMin: number;
  salaryMax: number;
  salaryCurrency: 'CNY';
  jobType: 'full_time' | 'part_time' | 'contract' | 'intern';
  experienceMin: number;
  experienceMax: number;
  educationRequirement: 'high_school' | 'associate' | 'bachelor' | 'master' | 'phd' | 'none';
  description: string;
  requirements: string[];
  benefits: string[];
  status: JobStatus;
  caVerified: boolean;
  viewCount: number;
  applyCount: number;
  publishedAt?: ISODateTime;
  closedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface CreateJobRequest {
  title: string;
  department: string;
  location: string;
  salaryMin: number;
  salaryMax: number;
  jobType: Job['jobType'];
  experienceMin: number;
  experienceMax: number;
  educationRequirement: Job['educationRequirement'];
  description: string;
  requirements: string[];
  benefits: string[];
}

// ─── Candidate & Application ─────────────────────────────────────────────────

export type ApplicationStatus =
  | 'applied'
  | 'screening'
  | 'interview_scheduled'
  | 'interviewing'
  | 'offer_pending'
  | 'offer_sent'
  | 'offer_accepted'
  | 'offer_rejected'
  | 'hired'
  | 'rejected'
  | 'withdrawn';

export interface Candidate {
  id: UUID;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  currentCompany?: string;
  currentTitle?: string;
  yearsOfExperience: number;
  education: string;
  skills: string[];
  resumeUrl?: string;
  source: 'direct' | 'referral' | 'headhunt' | 'talent_pool';
  trustScore: number;
  createdAt: ISODateTime;
}

export interface Application {
  id: UUID;
  tenantId: TenantId;
  jobId: UUID;
  candidateId: UUID;
  status: ApplicationStatus;
  stage: string;
  aiScore?: number;
  aiRecommendation?: string;
  appliedAt: ISODateTime;
  updatedAt: ISODateTime;
  candidate?: Candidate;
  job?: Job;
}

// ─── Interview ───────────────────────────────────────────────────────────────

export type InterviewType = 'phone' | 'video' | 'onsite' | 'async_video' | 'ai_screening';
export type InterviewStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export interface Interview {
  id: UUID;
  tenantId: TenantId;
  applicationId: UUID;
  type: InterviewType;
  status: InterviewStatus;
  scheduledAt: ISODateTime;
  duration: number; // minutes
  interviewers: UUID[];
  location?: string;
  meetingUrl?: string;
  feedback?: InterviewFeedback;
  aiAnalysis?: AIInterviewAnalysis;
  createdAt: ISODateTime;
}

export interface InterviewFeedback {
  overallScore: number; // 1-5
  technicalScore: number;
  communicationScore: number;
  cultureFitScore: number;
  strengths: string[];
  concerns: string[];
  recommendation: 'strong_hire' | 'hire' | 'no_hire' | 'strong_no_hire';
  notes: string;
}

export interface AIInterviewAnalysis {
  sentimentScore: number;
  confidenceLevel: number;
  keyInsights: string[];
  riskFlags: string[];
  matchScore: number;
}

// ─── Trust & Evidence ────────────────────────────────────────────────────────

export type TrustLevel = 'L0_anonymous' | 'L1_basic' | 'L2_verified' | 'L3_ca_certified' | 'L4_judicial';

export interface TrustRecord {
  id: UUID;
  tenantId: TenantId;
  subjectType: 'enterprise' | 'candidate' | 'job';
  subjectId: UUID;
  trustLevel: TrustLevel;
  evidenceHash: string; // SM3 hash
  caSignature?: string; // SM2 signature
  verifiedAt: ISODateTime;
  expiresAt: ISODateTime;
  metadata: Record<string, unknown>;
}

export interface EvidenceChain {
  id: UUID;
  operationType: string;
  operatorId: UUID;
  operatorName: string;
  timestamp: ISODateTime;
  dataHash: string;
  previousHash: string;
  signature: string;
  payload: Record<string, unknown>;
}

// ─── Audit ───────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'login'
  | 'logout'
  | 'create'
  | 'update'
  | 'delete'
  | 'view'
  | 'export'
  | 'approve'
  | 'reject'
  | 'verify';

export interface AuditLog {
  id: UUID;
  tenantId: TenantId;
  userId: UUID;
  userName: string;
  action: AuditAction;
  resource: string;
  resourceId: UUID;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  timestamp: ISODateTime;
}

// ─── Dashboard & Analytics ───────────────────────────────────────────────────

export interface HiringMetrics {
  totalJobs: number;
  activeJobs: number;
  totalApplications: number;
  interviewRate: number;
  offerRate: number;
  hireRate: number;
  avgTimeToHire: number; // days
  avgTimeToInterview: number; // days
  trustVerifiedRate: number;
  periodComparison: {
    applications: { current: number; previous: number; change: number };
    interviews: { current: number; previous: number; change: number };
    hires: { current: number; previous: number; change: number };
  };
}

export interface PipelineStage {
  name: string;
  count: number;
  conversionRate: number;
}

// ─── Community & QA ──────────────────────────────────────────────────────────

export type PostStatus = 'pending_review' | 'published' | 'rejected' | 'archived';

export interface CommunityPost {
  id: UUID;
  tenantId: TenantId;
  authorId: UUID;
  authorName: string;
  authorRole: UserRole;
  authorVerified: boolean;
  title: string;
  content: string;
  category: 'hiring_tips' | 'industry_insight' | 'tool_review' | 'qa' | 'decision';
  tags: string[];
  status: PostStatus;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: ISODateTime;
}

export interface JobQAItem {
  id: UUID;
  jobId: UUID;
  question: string;
  answer: string;
  answeredBy: UUID;
  answeredByName: string;
  isOfficial: boolean;
  caVerified: boolean;
  helpfulCount: number;
  createdAt: ISODateTime;
}

// ─── Decision & Command Center ──────────────────────────────────────────────

export type DecisionType = 'Hire' | 'Promote' | 'Transfer' | 'Upskill' | 'Retain' | 'Replace';
export type DecisionStatus = 'pending' | 'approved' | 'rejected';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface DecisionProposal {
  id: string;
  type: DecisionType;
  candidate: string;
  position: string;
  confidence: number;
  riskLevel: RiskLevel;
  status: DecisionStatus;
  timestamp: string;
  evidenceCount: number;
  lineageHash: string;
  modelVersion: string;
  promptVersion: string;
}

export interface OrgHealthMetric {
  value: string | number;
  trend: string;
  label: string;
}

export type OrgHealthMetrics = Record<string, OrgHealthMetric>;

export type SSEEventPriority = 'high' | 'medium' | 'low';

export interface SSEEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  priority: SSEEventPriority;
}

// ─── Pipeline (Kanban) ──────────────────────────────────────────────────────

export type PipelineStageKey = 'sourcing' | 'screening' | 'interviewing' | 'risk_check' | 'offering' | 'signed';

export interface PipelineCandidate {
  id: string;
  name: string;
  avatar: string;
  position: string;
  stage: PipelineStageKey;
  matchScore: number;
  riskScore: number;
  tags: string[];
  appliedDate: string;
  suspendGate?: string;
}

// ─── Knowledge Graph ────────────────────────────────────────────────────────

export type GraphNodeType = 'talent' | 'company' | 'skill' | 'position';

export interface GraphNode {
  id: string;
  name: string;
  type: GraphNodeType;
  x: number;
  y: number;
  connections: number;
  caVerified: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  caSigned: boolean;
  weight: number;
}

// ─── AI Sourcing ────────────────────────────────────────────────────────────

export interface SourcingResult {
  id: string;
  name: string;
  currentRole: string;
  company: string;
  matchScore: number;
  skills: string[];
  source: string;
  reachable: boolean;
  contacted: boolean;
}

export interface SourcingStrategy {
  query: string;
  strategy: string;
  channels: { name: string; weight: number }[];
  expectedYield: number;
}

// ─── AI Interview Session ───────────────────────────────────────────────────

export type InterviewSessionStatus = 'scheduled' | 'in_progress' | 'completed' | 'scored';

export interface ChatMessage {
  role: 'ai' | 'candidate' | 'system';
  content: string;
  timestamp: string;
  evidenceLink?: string;
}

export interface InterviewSession {
  id: string;
  candidate: string;
  position: string;
  status: InterviewSessionStatus;
  startTime: string;
  duration: number;
  hardSkillScore: number;
  softSkillScore: number;
  authenticityScore: number;
  dynamicQuestions: number;
  transcript: ChatMessage[];
}

// ─── Endorsement (背书) ─────────────────────────────────────────────────────

export type EndorsementStatus = 'generated' | 'signed' | 'shared' | 'verified' | 'converted';

export interface EndorsementCard {
  id: string;
  candidate: string;
  position: string;
  issuer: string;
  status: EndorsementStatus;
  caSignature: string;
  sm3Hash: string;
  shareUrl: string;
  createdAt: string;
  verifiedCount: number;
}

// ─── Expert Review ──────────────────────────────────────────────────────────

export type ExpertReviewStatus = 'pending' | 'in_progress' | 'completed';

export interface ExpertReview {
  id: string;
  candidate: string;
  position: string;
  domain: string;
  deadline: string;
  status: ExpertReviewStatus;
  reward: number;
  anonymized: boolean;
}

// ─── Succession Planning (国企继任) ─────────────────────────────────────────

export interface SuccessionCandidate {
  name: string;
  score: number;
  gap: string;
}

export interface SuccessionSlot {
  id: string;
  position: string;
  incumbent: string;
  readiness: 'ready_now' | 'ready_1yr' | 'ready_2yr';
  candidates: SuccessionCandidate[];
  riskLevel: RiskLevel;
}

export interface SuccessionPlanItem {
  id: string;
  position: string;
  riskLevel: RiskLevel;
  incumbent: { name: string; tenure: number; retireIn: number };
  successors: { name: string; currentRole: string; readiness: number }[];
}

// ─── Talent Commons (人才共享大厅) ──────────────────────────────────────────

export interface TalentCommonsItem {
  id: string;
  name: string;
  organization: string;
  domains: string[];
  shareType: string;
  availableFrom: string;
  caVerified: boolean;
}

// ─── Decision Lineage (决策血统) ────────────────────────────────────────────

export interface EvidenceLink {
  type: string;
  source: string;
  confidence: number;
}

export interface CounterEvidence {
  type: string;
  source: string;
  note: string;
}

export interface DecisionLineageStep {
  id: string;
  phase: string;
  action: string;
  actor: string;
  timestamp: string;
  evidenceLinks: EvidenceLink[];
  counterEvidence?: CounterEvidence[];
  modelVersion?: string;
  promptVersion?: string;
  sm3Hash: string;
  caSignature?: string;
}
