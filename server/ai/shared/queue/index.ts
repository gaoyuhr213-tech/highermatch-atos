/**
 * 蓉才通™ ATOS — Job Queue (BullMQ)
 * 
 * 异步任务队列，用于：
 * - Whisper ASR 转写
 * - Resume 解析
 * - AI 评分计算
 * - 面试报告生成
 * - 邮件发送
 * - 人才图谱更新
 * 
 * Queue Naming:
 * - hm:queue:whisper        → ASR转写任务
 * - hm:queue:resume-parse   → 简历解析
 * - hm:queue:ai-score       → AI评分
 * - hm:queue:report-gen     → 报告生成
 * - hm:queue:email-send     → 邮件发送
 * - hm:queue:graph-update   → 图谱更新
 */

import { Queue, Worker, Job, type ConnectionOptions } from 'bullmq';

const REDIS_CONNECTION: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
};

// ─── Queue Definitions ───────────────────────────────────────────────────────

export type QueueName =
  | 'whisper'
  | 'resume-parse'
  | 'ai-score'
  | 'report-gen'
  | 'email-send'
  | 'graph-update'
  | 'interview-followup'
  | 'sourcing-search';

export interface JobPayloads {
  whisper: WhisperJobPayload;
  'resume-parse': ResumeParseJobPayload;
  'ai-score': AIScoreJobPayload;
  'report-gen': ReportGenJobPayload;
  'email-send': EmailSendJobPayload;
  'graph-update': GraphUpdateJobPayload;
  'interview-followup': InterviewFollowupJobPayload;
  'sourcing-search': SourcingSearchJobPayload;
}

// ─── Job Payload Types ───────────────────────────────────────────────────────

export interface WhisperJobPayload {
  sessionId: string;
  tenantId: string;
  audioUrl: string;
  language?: string;
  format: 'webm' | 'mp3' | 'wav';
  chunkIndex?: number;
}

export interface ResumeParseJobPayload {
  tenantId: string;
  candidateId: string;
  fileUrl: string;
  fileType: 'pdf' | 'docx' | 'txt';
  positionId?: string; // For matching context
}

export interface AIScoreJobPayload {
  tenantId: string;
  sessionId: string;
  candidateId: string;
  positionId: string;
  transcriptSnapshot: string;
  competencies: string[];
}

export interface ReportGenJobPayload {
  tenantId: string;
  sessionId: string;
  candidateId: string;
  positionId: string;
  type: 'interview_summary' | 'candidate_profile' | 'comparison';
}

export interface EmailSendJobPayload {
  tenantId: string;
  to: string;
  subject: string;
  body: string;
  template?: string;
  variables?: Record<string, string>;
}

export interface GraphUpdateJobPayload {
  tenantId: string;
  entityType: 'candidate' | 'position' | 'skill' | 'company';
  entityId: string;
  operation: 'create' | 'update' | 'link';
  data: Record<string, unknown>;
}

export interface InterviewFollowupJobPayload {
  sessionId: string;
  tenantId: string;
  lastAnswer: string;
  questionContext: string;
  competency: string;
}

export interface SourcingSearchJobPayload {
  tenantId: string;
  query: string;
  filters: {
    location?: string;
    experienceMin?: number;
    experienceMax?: number;
    skills?: string[];
    education?: string;
  };
  maxResults: number;
}

// ─── Queue Factory ───────────────────────────────────────────────────────────

const queues = new Map<QueueName, Queue>();

export function getQueue<T extends QueueName>(name: T): Queue<JobPayloads[T]> {
  if (!queues.has(name)) {
    const queue = new Queue<JobPayloads[T]>(name, {
      connection: REDIS_CONNECTION,
      prefix: 'hm:queue',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
    queues.set(name, queue as unknown as Queue);
  }
  return queues.get(name) as unknown as Queue<JobPayloads[T]>;
}

// ─── Worker Factory ──────────────────────────────────────────────────────────

export function createWorker<T extends QueueName>(
  name: T,
  processor: (job: Job<JobPayloads[T]>) => Promise<unknown>,
  options: { concurrency?: number; limiter?: { max: number; duration: number } } = {}
): Worker<JobPayloads[T]> {
  const worker = new Worker<JobPayloads[T]>(name, processor, {
    connection: REDIS_CONNECTION,
    prefix: 'hm:queue',
    concurrency: options.concurrency || 5,
    limiter: options.limiter,
  });

  worker.on('completed', (job) => {
    console.log(`[Queue:${name}] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Queue:${name}] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

// ─── Convenience: Add Job ────────────────────────────────────────────────────

export async function enqueue<T extends QueueName>(
  queueName: T,
  data: JobPayloads[T],
  options?: { priority?: number; delay?: number; jobId?: string }
): Promise<Job<JobPayloads[T]>> {
  const queue = getQueue(queueName);
  return queue.add(queueName, data, {
    priority: options?.priority,
    delay: options?.delay,
    jobId: options?.jobId,
  });
}

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

export async function shutdownQueues(): Promise<void> {
  for (const [name, queue] of queues) {
    await queue.close();
    console.log(`[Queue:${name}] Closed`);
  }
  queues.clear();
}
