/**
 * 蓉才通™ ATOS — Interview React Query Hooks
 * 
 * 将 interviewService 封装为 React Query hooks：
 * - useCreateSession
 * - useStartSession
 * - useCompleteSession
 * - useInterviewReport
 * - useInterviewTranscript
 * - useInterviewSessions
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { interviewService, type CreateSessionRequest } from '../lib/api/interview-service';

const KEYS = {
  sessions: ['interview', 'sessions'] as const,
  session: (id: string) => ['interview', 'session', id] as const,
  transcript: (id: string) => ['interview', 'transcript', id] as const,
  report: (id: string) => ['interview', 'report', id] as const,
};

/** 创建面试会话 */
export function useCreateInterviewSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSessionRequest) => interviewService.createSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.sessions });
    },
  });
}

/** 启动面试 */
export function useStartInterviewSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => interviewService.startSession(sessionId),
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: KEYS.session(sessionId) });
    },
  });
}

/** 结束面试 */
export function useCompleteInterviewSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => interviewService.completeSession(sessionId),
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: KEYS.session(sessionId) });
      queryClient.invalidateQueries({ queryKey: KEYS.sessions });
    },
  });
}

/** 取消面试 */
export function useCancelInterviewSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, reason }: { sessionId: string; reason?: string }) =>
      interviewService.cancelSession(sessionId, reason),
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: KEYS.session(sessionId) });
      queryClient.invalidateQueries({ queryKey: KEYS.sessions });
    },
  });
}

/** 推进问题 */
export function useAdvanceQuestion() {
  return useMutation({
    mutationFn: (sessionId: string) => interviewService.advanceQuestion(sessionId),
  });
}

/** 获取面试会话详情 */
export function useInterviewSession(sessionId: string | null) {
  return useQuery({
    queryKey: KEYS.session(sessionId || ''),
    queryFn: () => interviewService.getSession(sessionId!),
    enabled: !!sessionId,
    refetchInterval: 5000, // Poll every 5s during active session
  });
}

/** 获取面试转写 */
export function useInterviewTranscript(sessionId: string | null) {
  return useQuery({
    queryKey: KEYS.transcript(sessionId || ''),
    queryFn: () => interviewService.getTranscript(sessionId!),
    enabled: !!sessionId,
    refetchInterval: 3000, // Poll every 3s for new transcript
  });
}

/** 获取面试报告 */
export function useInterviewReport(sessionId: string | null) {
  return useQuery({
    queryKey: KEYS.report(sessionId || ''),
    queryFn: () => interviewService.getReport(sessionId!),
    enabled: !!sessionId,
    staleTime: Infinity, // Report doesn't change once generated
  });
}

/** 获取面试列表 */
export function useInterviewSessions(params?: {
  candidateId?: string;
  positionId?: string;
  status?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: [...KEYS.sessions, params],
    queryFn: () => interviewService.listSessions(params),
  });
}
