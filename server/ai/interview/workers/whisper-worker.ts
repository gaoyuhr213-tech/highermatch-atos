/**
 * 蓉才通™ ATOS — Whisper ASR Worker
 * 
 * Pipeline: Audio → Whisper API → Transcript → Redis → Event Bus
 * 
 * 支持：
 * - 实时流式转写（chunked audio）
 * - 批量转写（完整录音）
 * - 多语言（中文/英文自动检测）
 * - 置信度评分
 * - 时间戳对齐
 */

import { createWorker, type WhisperJobPayload } from '../../shared/queue/index';
import { redis, type TranscriptEntry } from '../../shared/memory/redis';
import { eventBus } from '../../shared/events/bus';
import type { Job } from 'bullmq';

interface WhisperResponse {
  text: string;
  segments: WhisperSegment[];
  language: string;
  duration: number;
}

interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  avg_logprob: number;
  no_speech_prob: number;
}

async function processWhisperJob(job: Job<WhisperJobPayload>): Promise<WhisperResponse> {
  const { sessionId, tenantId, audioUrl, language, format } = job.data;

  job.updateProgress(10);

  // Download audio chunk
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) {
    throw new Error(`Failed to download audio: ${audioResponse.status}`);
  }
  const audioBlob = await audioResponse.blob();

  job.updateProgress(30);

  // Call Whisper API
  const formData = new FormData();
  formData.append('file', audioBlob, `chunk.${format}`);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'segment');
  if (language) formData.append('language', language);

  const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!whisperResponse.ok) {
    const error = await whisperResponse.text();
    throw new Error(`Whisper API error: ${whisperResponse.status} - ${error}`);
  }

  const result = await whisperResponse.json() as WhisperResponse;

  job.updateProgress(70);

  // Store transcript entries in Redis
  for (const segment of result.segments) {
    if (segment.no_speech_prob > 0.8) continue; // Skip non-speech

    const entry: TranscriptEntry = {
      id: `${sessionId}_${segment.id}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      speaker: 'candidate', // Default; speaker diarization would refine this
      text: segment.text.trim(),
      confidence: Math.exp(segment.avg_logprob), // Convert log prob to probability
      duration_ms: (segment.end - segment.start) * 1000,
      language: result.language,
    };

    await redis.appendTranscript(sessionId, entry);

    // Publish real-time transcript event
    eventBus.publish({
      type: 'interview:transcript',
      sessionId,
      tenantId,
      timestamp: entry.timestamp,
      data: entry,
      metadata: { agentName: 'whisper-worker' },
    });
  }

  job.updateProgress(100);

  return result;
}

// ─── Worker Registration ─────────────────────────────────────────────────────

export function startWhisperWorker(): void {
  createWorker('whisper', processWhisperJob, {
    concurrency: 10,
    limiter: { max: 50, duration: 60_000 }, // 50 jobs per minute
  });
  console.log('[Worker:whisper] Started with concurrency=10');
}
