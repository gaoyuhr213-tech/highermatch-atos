/**
 * HigherMatch ATOS — API Services
 * 
 * 按领域组织的typed API调用，每个方法返回强类型数据
 */

import { apiClient, type ApiResponse } from './client';
import type {
  AuthTokens,
  LoginRequest,
  UShieldChallenge,
  User,
  Enterprise,
  Job,
  CreateJobRequest,
  Application,
  ApplicationStatus,
  Interview,
  InterviewFeedback,
  TrustRecord,
  EvidenceChain,
  AuditLog,
  HiringMetrics,
  PipelineStage,
  CommunityPost,
  JobQAItem,
  PaginatedResponse,
  PaginationParams,
  UUID,
  DecisionProposal,
  OrgHealthMetrics,
  SSEEvent,
  PipelineCandidate,
  GraphNode,
  GraphEdge,
  SourcingResult,
  SourcingStrategy,
  InterviewSession,
  EndorsementCard,
  ExpertReview,
  SuccessionPlanItem,
  TalentCommonsItem,
  DecisionLineageStep,
} from './types';

// ─── Auth Service ────────────────────────────────────────────────────────────

export const authService = {
  /** 获取U盾挑战码 */
  getUShieldChallenge(): Promise<ApiResponse<UShieldChallenge>> {
    return apiClient.post('/auth/ushield/challenge');
  },

  /** 登录 */
  login(req: LoginRequest): Promise<ApiResponse<AuthTokens & { user: User }>> {
    return apiClient.post('/auth/login', req, { skipAuth: true });
  },

  /** 刷新Token */
  refresh(refreshToken: string): Promise<ApiResponse<AuthTokens>> {
    return apiClient.post('/auth/refresh', { refreshToken }, { skipAuth: true });
  },

  /** 登出 */
  logout(): Promise<ApiResponse<void>> {
    return apiClient.post('/auth/logout');
  },

  /** 获取当前用户 */
  getCurrentUser(): Promise<ApiResponse<User>> {
    return apiClient.get('/auth/me');
  },

  /** 修改密码 */
  changePassword(oldPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    return apiClient.post('/auth/change-password', { oldPassword, newPassword });
  },
};

// ─── Enterprise Service ──────────────────────────────────────────────────────

export const enterpriseService = {
  /** 获取企业信息 */
  getEnterprise(id: UUID): Promise<ApiResponse<Enterprise>> {
    return apiClient.get(`/enterprises/${id}`);
  },

  /** 获取当前租户企业 */
  getCurrentEnterprise(): Promise<ApiResponse<Enterprise>> {
    return apiClient.get('/enterprises/current');
  },

  /** 更新企业信息 */
  updateEnterprise(id: UUID, data: Partial<Enterprise>): Promise<ApiResponse<Enterprise>> {
    return apiClient.patch(`/enterprises/${id}`, data);
  },

  /** 发起CA认证 */
  requestCAVerification(enterpriseId: UUID, certData: { certSN: string; signature: string }): Promise<ApiResponse<{ verificationId: string }>> {
    return apiClient.post(`/enterprises/${enterpriseId}/ca-verify`, certData);
  },

  /** 查询CA认证状态 */
  getCAVerificationStatus(enterpriseId: UUID): Promise<ApiResponse<{ status: string; verifiedAt?: string }>> {
    return apiClient.get(`/enterprises/${enterpriseId}/ca-status`);
  },
};

// ─── Job Service ─────────────────────────────────────────────────────────────

export const jobService = {
  /** 获取岗位列表 */
  listJobs(params?: PaginationParams & { status?: string; keyword?: string }): Promise<ApiResponse<PaginatedResponse<Job>>> {
    return apiClient.get('/jobs', params as Record<string, string | number | boolean>);
  },

  /** 获取岗位详情 */
  getJob(id: UUID): Promise<ApiResponse<Job>> {
    return apiClient.get(`/jobs/${id}`);
  },

  /** 创建岗位 */
  createJob(data: CreateJobRequest): Promise<ApiResponse<Job>> {
    return apiClient.post('/jobs', data);
  },

  /** 更新岗位 */
  updateJob(id: UUID, data: Partial<CreateJobRequest>): Promise<ApiResponse<Job>> {
    return apiClient.patch(`/jobs/${id}`, data);
  },

  /** 发布岗位 */
  publishJob(id: UUID): Promise<ApiResponse<Job>> {
    return apiClient.post(`/jobs/${id}/publish`);
  },

  /** 关闭岗位 */
  closeJob(id: UUID, reason?: string): Promise<ApiResponse<Job>> {
    return apiClient.post(`/jobs/${id}/close`, { reason });
  },

  /** 删除岗位 */
  deleteJob(id: UUID): Promise<ApiResponse<void>> {
    return apiClient.delete(`/jobs/${id}`);
  },
};

// ─── Application Service ─────────────────────────────────────────────────────

export const applicationService = {
  /** 获取申请列表 */
  listApplications(params?: PaginationParams & { jobId?: UUID; status?: ApplicationStatus }): Promise<ApiResponse<PaginatedResponse<Application>>> {
    return apiClient.get('/applications', params as Record<string, string | number | boolean>);
  },

  /** 获取申请详情 */
  getApplication(id: UUID): Promise<ApiResponse<Application>> {
    return apiClient.get(`/applications/${id}`);
  },

  /** 更新申请状态 */
  updateStatus(id: UUID, status: ApplicationStatus, notes?: string): Promise<ApiResponse<Application>> {
    return apiClient.patch(`/applications/${id}/status`, { status, notes });
  },

  /** 批量操作 */
  batchUpdateStatus(ids: UUID[], status: ApplicationStatus): Promise<ApiResponse<{ updated: number }>> {
    return apiClient.post('/applications/batch-status', { ids, status });
  },

  /** AI评分 */
  requestAIScore(id: UUID): Promise<ApiResponse<{ score: number; recommendation: string; factors: string[] }>> {
    return apiClient.post(`/applications/${id}/ai-score`);
  },
};

// ─── Interview Service ───────────────────────────────────────────────────────

export const interviewService = {
  /** 获取面试列表 */
  listInterviews(params?: PaginationParams & { applicationId?: UUID; status?: string }): Promise<ApiResponse<PaginatedResponse<Interview>>> {
    return apiClient.get('/interviews', params as Record<string, string | number | boolean>);
  },

  /** 创建面试 */
  scheduleInterview(data: { applicationId: UUID; type: string; scheduledAt: string; duration: number; interviewers: UUID[] }): Promise<ApiResponse<Interview>> {
    return apiClient.post('/interviews', data);
  },

  /** 提交面试反馈 */
  submitFeedback(id: UUID, feedback: InterviewFeedback): Promise<ApiResponse<Interview>> {
    return apiClient.post(`/interviews/${id}/feedback`, feedback);
  },

  /** 取消面试 */
  cancelInterview(id: UUID, reason: string): Promise<ApiResponse<Interview>> {
    return apiClient.post(`/interviews/${id}/cancel`, { reason });
  },

  /** 获取AI面试分析 */
  getAIAnalysis(id: UUID): Promise<ApiResponse<Interview['aiAnalysis']>> {
    return apiClient.get(`/interviews/${id}/ai-analysis`);
  },
};

// ─── Trust Service ───────────────────────────────────────────────────────────

export const trustService = {
  /** 获取信任记录 */
  getTrustRecord(subjectType: string, subjectId: UUID): Promise<ApiResponse<TrustRecord>> {
    return apiClient.get(`/trust/records/${subjectType}/${subjectId}`);
  },

  /** 获取存证链 */
  getEvidenceChain(subjectId: UUID, params?: PaginationParams): Promise<ApiResponse<PaginatedResponse<EvidenceChain>>> {
    return apiClient.get(`/trust/evidence/${subjectId}`, params as Record<string, string | number | boolean>);
  },

  /** 验证存证 */
  verifyEvidence(evidenceId: UUID): Promise<ApiResponse<{ valid: boolean; verifiedAt: string }>> {
    return apiClient.post(`/trust/evidence/${evidenceId}/verify`);
  },

  /** 获取信任链路状态 */
  getTrustChainStatus(): Promise<ApiResponse<{ steps: { name: string; status: string; completedAt?: string }[] }>> {
    return apiClient.get('/trust/chain-status');
  },
};

// ─── Audit Service ───────────────────────────────────────────────────────────

export const auditService = {
  /** 获取审计日志 */
  listAuditLogs(params?: PaginationParams & { userId?: UUID; action?: string; resource?: string; startDate?: string; endDate?: string }): Promise<ApiResponse<PaginatedResponse<AuditLog>>> {
    return apiClient.get('/audit/logs', params as Record<string, string | number | boolean>);
  },

  /** 导出审计日志 */
  exportAuditLogs(params: { startDate: string; endDate: string; format: 'csv' | 'json' }): Promise<ApiResponse<{ downloadUrl: string }>> {
    return apiClient.post('/audit/export', params);
  },
};

// ─── Analytics Service ───────────────────────────────────────────────────────

export const analyticsService = {
  /** 获取招聘指标 */
  getHiringMetrics(period?: 'week' | 'month' | 'quarter'): Promise<ApiResponse<HiringMetrics>> {
    return apiClient.get('/analytics/hiring-metrics', { period });
  },

  /** 获取Pipeline漏斗 */
  getPipelineStages(jobId?: UUID): Promise<ApiResponse<PipelineStage[]>> {
    return apiClient.get('/analytics/pipeline', { jobId });
  },

  /** 获取信任指标 */
  getTrustMetrics(): Promise<ApiResponse<{ verifiedEnterprises: number; totalEnterprises: number; avgTrustScore: number; applicationRateBoost: number }>> {
    return apiClient.get('/analytics/trust-metrics');
  },
};

// ─── Community Service ───────────────────────────────────────────────────────

export const communityService = {
  /** 获取帖子列表 */
  listPosts(params?: PaginationParams & { category?: string }): Promise<ApiResponse<PaginatedResponse<CommunityPost>>> {
    return apiClient.get('/community/posts', params as Record<string, string | number | boolean>);
  },

  /** 创建帖子 */
  createPost(data: { title: string; content: string; category: string; tags: string[] }): Promise<ApiResponse<CommunityPost>> {
    return apiClient.post('/community/posts', data);
  },

  /** 点赞 */
  likePost(id: UUID): Promise<ApiResponse<{ likeCount: number }>> {
    return apiClient.post(`/community/posts/${id}/like`);
  },
};

// ─── Job QA Service ──────────────────────────────────────────────────────────

export const jobQAService = {
  /** 获取岗位QA列表 */
  listQA(jobId: UUID): Promise<ApiResponse<JobQAItem[]>> {
    return apiClient.get(`/jobs/${jobId}/qa`);
  },

  /** 提交问题 */
  askQuestion(jobId: UUID, question: string): Promise<ApiResponse<JobQAItem>> {
    return apiClient.post(`/jobs/${jobId}/qa`, { question });
  },

  /** 回答问题 */
  answerQuestion(jobId: UUID, qaId: UUID, answer: string): Promise<ApiResponse<JobQAItem>> {
    return apiClient.post(`/jobs/${jobId}/qa/${qaId}/answer`, { answer });
  },
};

// ─── Decision / Command Center Service ───────────────────────────────────────

export const decisionService = {
  /** 获取决策提案列表 */
  listProposals(params?: PaginationParams & { status?: string }): Promise<ApiResponse<PaginatedResponse<DecisionProposal>>> {
    return apiClient.get('/decisions/proposals', params as Record<string, string | number | boolean>);
  },

  /** 审批决策 */
  approveProposal(id: string): Promise<ApiResponse<DecisionProposal>> {
    return apiClient.post(`/decisions/proposals/${id}/approve`);
  },

  /** 驳回决策 */
  rejectProposal(id: string, reason: string): Promise<ApiResponse<DecisionProposal>> {
    return apiClient.post(`/decisions/proposals/${id}/reject`, { reason });
  },

  /** 获取组织健康指标 */
  getOrgHealthMetrics(): Promise<ApiResponse<OrgHealthMetrics>> {
    return apiClient.get('/org/health-metrics');
  },

  /** 获取实时事件流 */
  getEvents(params?: PaginationParams): Promise<ApiResponse<SSEEvent[]>> {
    return apiClient.get('/events/stream', params as Record<string, string | number | boolean>);
  },
};

// ─── Pipeline Service ────────────────────────────────────────────────────────

export const pipelineService = {
  /** 获取看板候选人列表 */
  listCandidates(params?: PaginationParams & { stage?: string }): Promise<ApiResponse<PipelineCandidate[]>> {
    return apiClient.get('/pipeline/candidates', params as Record<string, string | number | boolean>);
  },

  /** 移动候选人阶段 */
  moveStage(candidateId: string, newStage: string): Promise<ApiResponse<PipelineCandidate>> {
    return apiClient.patch(`/pipeline/candidates/${candidateId}/stage`, { stage: newStage });
  },

  /** 解除暂停门禁 */
  resolveSuspendGate(candidateId: string): Promise<ApiResponse<PipelineCandidate>> {
    return apiClient.post(`/pipeline/candidates/${candidateId}/resolve-gate`);
  },
};

// ─── Graph Service ───────────────────────────────────────────────────────────

export const graphService = {
  /** 获取知识图谱节点 */
  getNodes(params?: { type?: string }): Promise<ApiResponse<GraphNode[]>> {
    return apiClient.get('/graph/nodes', params as Record<string, string | number | boolean>);
  },

  /** 获取知识图谱边 */
  getEdges(): Promise<ApiResponse<GraphEdge[]>> {
    return apiClient.get('/graph/edges');
  },
};

// ─── Sourcing Service ────────────────────────────────────────────────────────

export const sourcingService = {
  /** 搜索候选人 */
  search(query: string, params?: PaginationParams): Promise<ApiResponse<SourcingResult[]>> {
    return apiClient.get('/sourcing/results', { q: query, ...params } as Record<string, string | number | boolean>);
  },

  /** 生成寻访策略 */
  generateStrategy(query: string): Promise<ApiResponse<SourcingStrategy>> {
    return apiClient.post('/sourcing/strategy', { query });
  },

  /** 联系候选人 */
  contactCandidate(candidateId: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiClient.post(`/sourcing/contact/${candidateId}`);
  },

  /** 批量联系 */
  batchContact(candidateIds: string[]): Promise<ApiResponse<{ contacted: number }>> {
    return apiClient.post('/sourcing/contact/batch', { ids: candidateIds });
  },
};

// ─── Interview Session Service ───────────────────────────────────────────────

export const interviewSessionService = {
  /** 获取面试会话列表 */
  listSessions(params?: PaginationParams & { status?: string }): Promise<ApiResponse<InterviewSession[]>> {
    return apiClient.get('/interview-sessions', params as Record<string, string | number | boolean>);
  },

  /** 获取面试会话详情 */
  getSession(id: string): Promise<ApiResponse<InterviewSession>> {
    return apiClient.get(`/interview-sessions/${id}`);
  },

  /** 开始面试 */
  startSession(id: string): Promise<ApiResponse<InterviewSession>> {
    return apiClient.post(`/interview-sessions/${id}/start`);
  },

  /** 结束面试并评分 */
  scoreSession(id: string): Promise<ApiResponse<InterviewSession>> {
    return apiClient.post(`/interview-sessions/${id}/score`);
  },
};

// ─── Endorsement Service ─────────────────────────────────────────────────────

export const endorsementService = {
  /** 获取背书卡列表 */
  listCards(params?: PaginationParams): Promise<ApiResponse<EndorsementCard[]>> {
    return apiClient.get('/endorsements', params as Record<string, string | number | boolean>);
  },

  /** 签发背书 */
  signCard(id: string): Promise<ApiResponse<EndorsementCard>> {
    return apiClient.post(`/endorsements/${id}/sign`);
  },

  /** 验证背书 */
  verifyCard(id: string): Promise<ApiResponse<EndorsementCard>> {
    return apiClient.post(`/endorsements/${id}/verify`);
  },

  /** 分享背书 */
  shareCard(id: string): Promise<ApiResponse<EndorsementCard>> {
    return apiClient.post(`/endorsements/${id}/share`);
  },
};

// ─── Expert Review Service ───────────────────────────────────────────────────

export const expertReviewService = {
  /** 获取专家评审列表 */
  listReviews(params?: PaginationParams & { status?: string }): Promise<ApiResponse<ExpertReview[]>> {
    return apiClient.get('/expert/reviews', params as Record<string, string | number | boolean>);
  },

  /** 接受评审任务 */
  acceptReview(id: string): Promise<ApiResponse<ExpertReview>> {
    return apiClient.post(`/expert/reviews/${id}/accept`);
  },

  /** 提交评审结果 */
  submitReview(id: string, payload: { score: number; comments: string }): Promise<ApiResponse<ExpertReview>> {
    return apiClient.post(`/expert/reviews/${id}/submit`, payload);
  },
};

// ─── Succession Service ──────────────────────────────────────────────────────

export const successionService = {
  /** 获取继任计划列表 */
  listPlans(params?: PaginationParams): Promise<ApiResponse<SuccessionPlanItem[]>> {
    return apiClient.get('/succession/plan', params as Record<string, string | number | boolean>);
  },

  /** 获取继任计划详情 */
  getPlan(id: string): Promise<ApiResponse<SuccessionPlanItem>> {
    return apiClient.get(`/succession/plans/${id}`);
  },
};

// ─── Talent Commons Service ──────────────────────────────────────────────────

export const talentCommonsService = {
  /** 获取共享人才列表 */
  listTalents(params?: PaginationParams): Promise<ApiResponse<TalentCommonsItem[]>> {
    return apiClient.get('/talent-commons', params as Record<string, string | number | boolean>);
  },

  /** 申请授权 */
  requestAccess(talentId: string, payload: { scope: string; duration: string; purpose: string }): Promise<ApiResponse<{ tokenId: string; scopedToken: string }>> {
    return apiClient.post(`/talent-commons/${talentId}/request-access`, payload);
  },
};

// ─── Decision Lineage Service ────────────────────────────────────────────────

export const decisionLineageService = {
  /** 获取决策血统链 */
  getLineage(decisionId: string): Promise<ApiResponse<DecisionLineageStep[]>> {
    return apiClient.get(`/decisions/lineage/${decisionId}`);
  },
};
