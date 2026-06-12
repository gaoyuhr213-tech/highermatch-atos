/**
 * HigherMatch ATOS — React Query Hooks
 * 
 * 将API服务封装为可组合的React hooks，提供：
 * - 自动缓存与失效
 * - 乐观更新
 * - 加载/错误状态
 * - 分页
 * - 请求去重
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery, type UseQueryOptions } from '@tanstack/react-query';
import {
  authService,
  enterpriseService,
  jobService,
  applicationService,
  interviewService,
  trustService,
  auditService,
  analyticsService,
  communityService,
  jobQAService,
} from './services';
import type {
  User,
  Enterprise,
  Job,
  CreateJobRequest,
  Application,
  ApplicationStatus,
  Interview,
  InterviewFeedback,
  HiringMetrics,
  PaginationParams,
  UUID,
  CommunityPost,
} from './types';

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  enterprise: {
    current: ['enterprise', 'current'] as const,
    detail: (id: UUID) => ['enterprise', id] as const,
  },
  jobs: {
    all: ['jobs'] as const,
    list: (params?: Record<string, unknown>) => ['jobs', 'list', params] as const,
    detail: (id: UUID) => ['jobs', 'detail', id] as const,
  },
  applications: {
    all: ['applications'] as const,
    list: (params?: Record<string, unknown>) => ['applications', 'list', params] as const,
    detail: (id: UUID) => ['applications', 'detail', id] as const,
  },
  interviews: {
    all: ['interviews'] as const,
    list: (params?: Record<string, unknown>) => ['interviews', 'list', params] as const,
  },
  trust: {
    record: (type: string, id: UUID) => ['trust', 'record', type, id] as const,
    chain: ['trust', 'chain-status'] as const,
    evidence: (id: UUID) => ['trust', 'evidence', id] as const,
  },
  audit: {
    logs: (params?: Record<string, unknown>) => ['audit', 'logs', params] as const,
  },
  analytics: {
    metrics: (period?: string) => ['analytics', 'metrics', period] as const,
    pipeline: (jobId?: UUID) => ['analytics', 'pipeline', jobId] as const,
    trust: ['analytics', 'trust'] as const,
  },
  community: {
    posts: (params?: Record<string, unknown>) => ['community', 'posts', params] as const,
  },
  jobQA: {
    list: (jobId: UUID) => ['jobQA', jobId] as const,
  },
} as const;

// ─── Auth Hooks ──────────────────────────────────────────────────────────────

export function useCurrentUser(options?: Partial<UseQueryOptions<User>>) {
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      const res = await authService.getCurrentUser();
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authService.login,
    onSuccess: (res) => {
      const { accessToken, refreshToken, user } = res.data;
      const { apiClient } = require('./client');
      apiClient.setTokens(accessToken, refreshToken);
      queryClient.setQueryData(queryKeys.auth.me, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authService.logout,
    onSuccess: () => {
      const { apiClient } = require('./client');
      apiClient.clearAuth();
      queryClient.clear();
    },
  });
}

// ─── Enterprise Hooks ────────────────────────────────────────────────────────

export function useCurrentEnterprise() {
  return useQuery({
    queryKey: queryKeys.enterprise.current,
    queryFn: async () => {
      const res = await enterpriseService.getCurrentEnterprise();
      return res.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useRequestCAVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ enterpriseId, certData }: { enterpriseId: UUID; certData: { certSN: string; signature: string } }) =>
      enterpriseService.requestCAVerification(enterpriseId, certData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.enterprise.current });
    },
  });
}

// ─── Job Hooks ───────────────────────────────────────────────────────────────

export function useJobs(params?: PaginationParams & { status?: string; keyword?: string }) {
  return useQuery({
    queryKey: queryKeys.jobs.list(params),
    queryFn: async () => {
      const res = await jobService.listJobs(params);
      return res.data;
    },
    staleTime: 30_000,
  });
}

export function useJob(id: UUID) {
  return useQuery({
    queryKey: queryKeys.jobs.detail(id),
    queryFn: async () => {
      const res = await jobService.getJob(id);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateJobRequest) => jobService.createJob(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: UUID; data: Partial<CreateJobRequest> }) => jobService.updateJob(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
  });
}

export function usePublishJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => jobService.publishJob(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
  });
}

// ─── Application Hooks ───────────────────────────────────────────────────────

export function useApplications(params?: PaginationParams & { jobId?: UUID; status?: ApplicationStatus }) {
  return useQuery({
    queryKey: queryKeys.applications.list(params),
    queryFn: async () => {
      const res = await applicationService.listApplications(params);
      return res.data;
    },
    staleTime: 15_000,
  });
}

export function useApplication(id: UUID) {
  return useQuery({
    queryKey: queryKeys.applications.detail(id),
    queryFn: async () => {
      const res = await applicationService.getApplication(id);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useUpdateApplicationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, notes }: { id: UUID; status: ApplicationStatus; notes?: string }) =>
      applicationService.updateStatus(id, status, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.metrics() });
    },
  });
}

export function useBatchUpdateStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: UUID[]; status: ApplicationStatus }) =>
      applicationService.batchUpdateStatus(ids, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });
    },
  });
}

export function useAIScore() {
  return useMutation({
    mutationFn: (id: UUID) => applicationService.requestAIScore(id),
  });
}

// ─── Interview Hooks ─────────────────────────────────────────────────────────

export function useInterviews(params?: PaginationParams & { applicationId?: UUID; status?: string }) {
  return useQuery({
    queryKey: queryKeys.interviews.list(params),
    queryFn: async () => {
      const res = await interviewService.listInterviews(params);
      return res.data;
    },
  });
}

export function useScheduleInterview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: interviewService.scheduleInterview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.interviews.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });
    },
  });
}

export function useSubmitFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, feedback }: { id: UUID; feedback: InterviewFeedback }) =>
      interviewService.submitFeedback(id, feedback),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.interviews.all });
    },
  });
}

// ─── Trust Hooks ─────────────────────────────────────────────────────────────

export function useTrustChainStatus() {
  return useQuery({
    queryKey: queryKeys.trust.chain,
    queryFn: async () => {
      const res = await trustService.getTrustChainStatus();
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useEvidenceChain(subjectId: UUID, params?: PaginationParams) {
  return useQuery({
    queryKey: queryKeys.trust.evidence(subjectId),
    queryFn: async () => {
      const res = await trustService.getEvidenceChain(subjectId, params);
      return res.data;
    },
    enabled: !!subjectId,
  });
}

// ─── Audit Hooks ─────────────────────────────────────────────────────────────

export function useAuditLogs(params?: PaginationParams & { userId?: UUID; action?: string; resource?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: queryKeys.audit.logs(params),
    queryFn: async () => {
      const res = await auditService.listAuditLogs(params);
      return res.data;
    },
  });
}

export function useExportAuditLogs() {
  return useMutation({
    mutationFn: auditService.exportAuditLogs,
  });
}

// ─── Analytics Hooks ─────────────────────────────────────────────────────────

export function useHiringMetrics(period?: 'week' | 'month' | 'quarter') {
  return useQuery({
    queryKey: queryKeys.analytics.metrics(period),
    queryFn: async () => {
      const res = await analyticsService.getHiringMetrics(period);
      return res.data;
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000, // auto-refresh every 5 min
  });
}

export function usePipelineStages(jobId?: UUID) {
  return useQuery({
    queryKey: queryKeys.analytics.pipeline(jobId),
    queryFn: async () => {
      const res = await analyticsService.getPipelineStages(jobId);
      return res.data;
    },
  });
}

export function useTrustMetrics() {
  return useQuery({
    queryKey: queryKeys.analytics.trust,
    queryFn: async () => {
      const res = await analyticsService.getTrustMetrics();
      return res.data;
    },
    staleTime: 5 * 60_000,
  });
}

// ─── Community Hooks ─────────────────────────────────────────────────────────

export function useCommunityPosts(params?: PaginationParams & { category?: string }) {
  return useQuery({
    queryKey: queryKeys.community.posts(params),
    queryFn: async () => {
      const res = await communityService.listPosts(params);
      return res.data;
    },
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: communityService.createPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community'] });
    },
  });
}

// ─── Job QA Hooks ────────────────────────────────────────────────────────────

export function useJobQA(jobId: UUID) {
  return useQuery({
    queryKey: queryKeys.jobQA.list(jobId),
    queryFn: async () => {
      const res = await jobQAService.listQA(jobId);
      return res.data;
    },
    enabled: !!jobId,
  });
}

export function useAskQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, question }: { jobId: UUID; question: string }) =>
      jobQAService.askQuestion(jobId, question),
    onSuccess: (_, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobQA.list(jobId) });
    },
  });
}

// ─── Decision / Command Center Hooks ─────────────────────────────────────────

import {
  decisionService,
  pipelineService,
  graphService,
  sourcingService,
  interviewSessionService,
  endorsementService,
  expertReviewService,
  successionService,
  talentCommonsService,
  decisionLineageService,
} from './services';
import type { PipelineCandidate } from './types';

export function useDecisionProposals(params?: PaginationParams & { status?: string }) {
  return useQuery({
    queryKey: ['decisions', 'proposals', params],
    queryFn: async () => {
      const res = await decisionService.listProposals(params);
      return res.data;
    },
  });
}

export function useApproveProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: decisionService.approveProposal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decisions'] });
    },
  });
}

export function useRejectProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      decisionService.rejectProposal(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decisions'] });
    },
  });
}

export function useOrgHealthMetrics() {
  return useQuery({
    queryKey: ['decisions', 'org-health'],
    queryFn: async () => {
      const res = await decisionService.getOrgHealthMetrics();
      return res.data;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useSSEEvents() {
  return useQuery({
    queryKey: ['decisions', 'events'],
    queryFn: async () => {
      const res = await decisionService.getEvents();
      return res.data;
    },
    refetchInterval: 5_000,
  });
}

// ─── Pipeline Hooks ──────────────────────────────────────────────────────────

export function usePipelineCandidates(params?: PaginationParams & { stage?: string }) {
  return useQuery({
    queryKey: ['pipeline', 'candidates', params],
    queryFn: async () => {
      const res = await pipelineService.listCandidates(params);
      return res.data;
    },
  });
}

export function useMoveStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ candidateId, newStage }: { candidateId: string; newStage: string }) =>
      pipelineService.moveStage(candidateId, newStage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    },
  });
}

export function useResolveSuspendGate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: pipelineService.resolveSuspendGate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    },
  });
}

// ─── Graph Hooks ─────────────────────────────────────────────────────────────

export function useGraphNodes(params?: { type?: string }) {
  return useQuery({
    queryKey: ['graph', 'nodes', params],
    queryFn: async () => {
      const res = await graphService.getNodes(params);
      return res.data;
    },
  });
}

export function useGraphEdges() {
  return useQuery({
    queryKey: ['graph', 'edges'],
    queryFn: async () => {
      const res = await graphService.getEdges();
      return res.data;
    },
  });
}

// ─── Sourcing Hooks ──────────────────────────────────────────────────────────

export function useSourcingResults(query: string) {
  return useQuery({
    queryKey: ['sourcing', 'results', query],
    queryFn: async () => {
      const res = await sourcingService.search(query);
      return res.data;
    },
    enabled: !!query,
  });
}

export function useGenerateStrategy() {
  return useMutation({
    mutationFn: sourcingService.generateStrategy,
  });
}

export function useContactCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sourcingService.contactCandidate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sourcing'] });
    },
  });
}

export function useBatchContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sourcingService.batchContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sourcing'] });
    },
  });
}

// ─── Interview Session Hooks ─────────────────────────────────────────────────

export function useInterviewSessions(params?: PaginationParams & { status?: string }) {
  return useQuery({
    queryKey: ['interview-sessions', 'list', params],
    queryFn: async () => {
      const res = await interviewSessionService.listSessions(params);
      return res.data;
    },
  });
}

export function useInterviewSessionDetail(id: string) {
  return useQuery({
    queryKey: ['interview-sessions', id],
    queryFn: async () => {
      const res = await interviewSessionService.getSession(id);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useStartInterviewSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: interviewSessionService.startSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interview-sessions'] });
    },
  });
}

export function useScoreInterviewSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: interviewSessionService.scoreSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interview-sessions'] });
    },
  });
}

// ─── Endorsement Hooks ───────────────────────────────────────────────────────

export function useEndorsementCards(params?: PaginationParams) {
  return useQuery({
    queryKey: ['endorsements', 'list', params],
    queryFn: async () => {
      const res = await endorsementService.listCards(params);
      return res.data;
    },
  });
}

export function useSignEndorsement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: endorsementService.signCard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['endorsements'] });
    },
  });
}

export function useVerifyEndorsement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: endorsementService.verifyCard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['endorsements'] });
    },
  });
}

export function useShareEndorsement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: endorsementService.shareCard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['endorsements'] });
    },
  });
}

// ─── Expert Review Hooks ─────────────────────────────────────────────────────

export function useExpertReviews(params?: PaginationParams & { status?: string }) {
  return useQuery({
    queryKey: ['expert-reviews', 'list', params],
    queryFn: async () => {
      const res = await expertReviewService.listReviews(params);
      return res.data;
    },
  });
}

export function useAcceptReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: expertReviewService.acceptReview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expert-reviews'] });
    },
  });
}

export function useSubmitReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { score: number; comments: string } }) =>
      expertReviewService.submitReview(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expert-reviews'] });
    },
  });
}

// ─── Succession Hooks ────────────────────────────────────────────────────────

export function useSuccessionPlans(params?: PaginationParams) {
  return useQuery({
    queryKey: ['succession', 'plans', params],
    queryFn: async () => {
      const res = await successionService.listPlans(params);
      return res.data;
    },
  });
}

// ─── Talent Commons Hooks ────────────────────────────────────────────────────

export function useTalentCommons(params?: PaginationParams) {
  return useQuery({
    queryKey: ['talent-commons', 'list', params],
    queryFn: async () => {
      const res = await talentCommonsService.listTalents(params);
      return res.data;
    },
  });
}

export function useRequestTalentAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ talentId, payload }: { talentId: string; payload: { scope: string; duration: string; purpose: string } }) =>
      talentCommonsService.requestAccess(talentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talent-commons'] });
    },
  });
}

// ─── Decision Lineage Hooks ──────────────────────────────────────────────────

export function useDecisionLineage(decisionId: string) {
  return useQuery({
    queryKey: ['lineage', decisionId],
    queryFn: async () => {
      const res = await decisionLineageService.getLineage(decisionId);
      return res.data;
    },
    enabled: !!decisionId,
  });
}
