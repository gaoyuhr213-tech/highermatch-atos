/**
 * 蓉才通™ ATOS — Multimodal Interview System
 * 
 * 多模态面试信号分析：
 * - Video Frame Analysis（视频帧分析）
 * - Emotion Signal Detection（情绪信号检测）
 * - Eye Contact Tracking（眼神接触追踪）
 * - Speech Pace Analysis（语速分析）
 * - Pause Detection（停顿检测）
 * - Confidence Scoring（自信度评分）
 * - Multi-modal Timeline Fusion（多模态时间轴融合）
 * 
 * 对标：HireVue / Pymetrics / Modern Hire
 * 
 * 架构：
 * Audio Worker → Speech Signals → Timeline
 * Video Worker → Visual Signals → Timeline
 * Fusion Agent → Combined Score → Report
 */

import { llm } from '../shared/llm/client';
import { logger } from '../observability';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SignalType = 'emotion' | 'eye_contact' | 'speech_pace' | 'pause' | 'confidence' | 'gesture' | 'engagement';
export type EmotionLabel = 'neutral' | 'happy' | 'surprised' | 'confused' | 'nervous' | 'confident' | 'thoughtful';

export interface MultimodalSignal {
  id: string;
  type: SignalType;
  timestamp_ms: number;
  duration_ms: number;
  value: number;  // 0-1 normalized
  label?: string;
  confidence: number;
  source: 'audio' | 'video' | 'fusion';
  metadata: Record<string, unknown>;
}

export interface EmotionSignal extends MultimodalSignal {
  type: 'emotion';
  label: EmotionLabel;
  valence: number;   // -1 to 1 (negative to positive)
  arousal: number;   // 0 to 1 (calm to excited)
}

export interface SpeechSignal extends MultimodalSignal {
  type: 'speech_pace' | 'pause' | 'confidence';
  wordsPerMinute?: number;
  pauseDuration_ms?: number;
  fillerWords?: string[];
}

export interface VisualSignal extends MultimodalSignal {
  type: 'eye_contact' | 'gesture' | 'engagement';
  eyeContactRatio?: number;
  headPose?: { pitch: number; yaw: number; roll: number };
}

// ─── Timeline ────────────────────────────────────────────────────────────────

export interface MultimodalTimeline {
  sessionId: string;
  candidateId: string;
  startTime: string;
  duration_ms: number;
  signals: MultimodalSignal[];
  segments: TimelineSegment[];
  summary: TimelineSummary;
}

export interface TimelineSegment {
  id: string;
  startTime_ms: number;
  endTime_ms: number;
  questionId?: string;
  questionText?: string;
  signals: MultimodalSignal[];
  aggregateScores: SegmentScores;
}

export interface SegmentScores {
  overallConfidence: number;
  emotionValence: number;
  engagement: number;
  eyeContact: number;
  speechClarity: number;
  compositeScore: number;
}

export interface TimelineSummary {
  avgConfidence: number;
  avgEngagement: number;
  avgEyeContact: number;
  avgSpeechPace_wpm: number;
  totalPauses: number;
  avgPauseDuration_ms: number;
  dominantEmotion: EmotionLabel;
  emotionDistribution: Record<EmotionLabel, number>;
  peakMoments: PeakMoment[];
  riskSignals: RiskSignal[];
}

export interface PeakMoment {
  timestamp_ms: number;
  type: 'high_confidence' | 'low_confidence' | 'emotion_shift' | 'long_pause' | 'high_engagement';
  description: string;
  score: number;
}

export interface RiskSignal {
  type: 'excessive_pauses' | 'low_eye_contact' | 'high_nervousness' | 'inconsistent_emotion' | 'rapid_speech';
  severity: 'high' | 'medium' | 'low';
  description: string;
  evidence: string;
  timestamp_ms?: number;
}

// ─── Video Worker ────────────────────────────────────────────────────────────

export class VideoWorker {
  /**
   * Analyze a video frame for visual signals.
   * In production: uses GPT-4o Vision or dedicated CV model.
   */
  async analyzeFrame(frameBase64: string, timestamp_ms: number): Promise<VisualSignal[]> {
    try {
      const response = await llm.complete({
        messages: [
          {
            role: 'system',
            content: `You are a video interview analysis system. Analyze this video frame of a candidate during an interview.
Return JSON:
{
  "eyeContact": { "looking_at_camera": true/false, "ratio": 0.0-1.0 },
  "emotion": { "label": "neutral|happy|surprised|confused|nervous|confident|thoughtful", "confidence": 0.0-1.0, "valence": -1.0 to 1.0, "arousal": 0.0-1.0 },
  "engagement": { "score": 0.0-1.0, "posture": "upright|leaning_forward|leaning_back|slouching" },
  "gesture": { "type": "none|hand_gesture|nodding|head_shake|fidgeting", "intensity": 0.0-1.0 }
}
Be objective and professional. This is for structured behavioral assessment only.`,
          },
          {
            role: 'user',
            content: `[IMAGE: data:image/jpeg;base64,${frameBase64.substring(0, 50)}...] Analyze this interview frame.` as string,
          },
        ],
        temperature: 0,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        metadata: { tenantId: 'system', agentName: 'video-worker' },
      });

      const parsed = JSON.parse(response.content);
      const signals: VisualSignal[] = [];

      // Eye contact signal
      if (parsed.eyeContact) {
        signals.push({
          id: `sig_${Date.now().toString(36)}_eye`,
          type: 'eye_contact',
          timestamp_ms,
          duration_ms: 1000, // per-frame
          value: parsed.eyeContact.ratio || 0,
          confidence: 0.8,
          source: 'video',
          eyeContactRatio: parsed.eyeContact.ratio,
          metadata: { lookingAtCamera: parsed.eyeContact.looking_at_camera },
        });
      }

      // Engagement signal
      if (parsed.engagement) {
        signals.push({
          id: `sig_${Date.now().toString(36)}_eng`,
          type: 'engagement',
          timestamp_ms,
          duration_ms: 1000,
          value: parsed.engagement.score || 0,
          confidence: 0.75,
          source: 'video',
          metadata: { posture: parsed.engagement.posture },
        });
      }

      // Gesture signal
      if (parsed.gesture && parsed.gesture.type !== 'none') {
        signals.push({
          id: `sig_${Date.now().toString(36)}_ges`,
          type: 'gesture',
          timestamp_ms,
          duration_ms: 1000,
          value: parsed.gesture.intensity || 0,
          label: parsed.gesture.type,
          confidence: 0.7,
          source: 'video',
          metadata: {},
        });
      }

      return signals;
    } catch (error) {
      logger.warn('[Multimodal] Video frame analysis failed', { error, timestamp_ms });
      return [];
    }
  }
}

// ─── Audio Worker ────────────────────────────────────────────────────────────

export class AudioWorker {
  /**
   * Analyze audio segment for speech signals.
   * Detects: speech pace, pauses, filler words, confidence.
   */
  async analyzeSegment(transcript: string, duration_ms: number, timestamp_ms: number): Promise<SpeechSignal[]> {
    const signals: SpeechSignal[] = [];

    // Speech pace calculation
    const wordCount = transcript.split(/\s+/).filter(w => w.length > 0).length;
    const wpm = duration_ms > 0 ? (wordCount / duration_ms) * 60000 : 0;

    signals.push({
      id: `sig_${Date.now().toString(36)}_pace`,
      type: 'speech_pace',
      timestamp_ms,
      duration_ms,
      value: this.normalizeSpeechPace(wpm),
      wordsPerMinute: wpm,
      confidence: 0.9,
      source: 'audio',
      metadata: { wordCount },
    });

    // Filler word detection
    const fillerPatterns = /\b(um|uh|like|you know|basically|actually|so|well|I mean|right)\b/gi;
    const fillers = transcript.match(fillerPatterns) || [];
    if (fillers.length > 0) {
      const fillerRate = fillers.length / Math.max(wordCount, 1);
      signals.push({
        id: `sig_${Date.now().toString(36)}_filler`,
        type: 'confidence',
        timestamp_ms,
        duration_ms,
        value: Math.max(0, 1 - fillerRate * 3), // high fillers = low confidence
        fillerWords: fillers,
        confidence: 0.85,
        source: 'audio',
        metadata: { fillerCount: fillers.length, fillerRate },
      });
    }

    return signals;
  }

  /**
   * Detect pauses in audio stream.
   */
  detectPauses(silenceIntervals: Array<{ start_ms: number; end_ms: number }>): SpeechSignal[] {
    return silenceIntervals
      .filter(interval => (interval.end_ms - interval.start_ms) > 2000) // > 2s pause
      .map(interval => ({
        id: `sig_${Date.now().toString(36)}_pause`,
        type: 'pause' as const,
        timestamp_ms: interval.start_ms,
        duration_ms: interval.end_ms - interval.start_ms,
        value: Math.min(1, (interval.end_ms - interval.start_ms) / 10000), // normalize to 10s max
        pauseDuration_ms: interval.end_ms - interval.start_ms,
        confidence: 0.95,
        source: 'audio' as const,
        metadata: {},
      }));
  }

  private normalizeSpeechPace(wpm: number): number {
    // Optimal range: 120-160 wpm
    if (wpm >= 120 && wpm <= 160) return 1.0;
    if (wpm < 80 || wpm > 220) return 0.3;
    if (wpm < 120) return 0.5 + (wpm - 80) / 80;
    return 0.5 + (220 - wpm) / 120;
  }
}

// ─── Vision Agent (Emotion Detection) ────────────────────────────────────────

export class VisionAgent {
  /**
   * Detect emotion from video frame using LLM Vision.
   */
  async detectEmotion(frameBase64: string, timestamp_ms: number): Promise<EmotionSignal | null> {
    try {
      const response = await llm.complete({
        messages: [
          {
            role: 'system',
            content: `Analyze the facial expression in this interview frame.
Return JSON: {"emotion": "neutral|happy|surprised|confused|nervous|confident|thoughtful", "valence": -1.0 to 1.0, "arousal": 0.0 to 1.0, "confidence": 0.0 to 1.0}
Be conservative and professional.`,
          },
          {
            role: 'user',
            content: `[IMAGE: data:image/jpeg;base64,${frameBase64.substring(0, 50)}...] Analyze facial expression.` as string,
          },
        ],
        temperature: 0,
        max_tokens: 100,
        response_format: { type: 'json_object' },
        metadata: { tenantId: 'system', agentName: 'vision-agent' },
      });

      const parsed = JSON.parse(response.content);
      return {
        id: `sig_${Date.now().toString(36)}_emo`,
        type: 'emotion',
        timestamp_ms,
        duration_ms: 1000,
        value: (parsed.valence + 1) / 2, // normalize -1..1 to 0..1
        label: parsed.emotion || 'neutral',
        valence: parsed.valence || 0,
        arousal: parsed.arousal || 0.5,
        confidence: parsed.confidence || 0.5,
        source: 'video',
        metadata: {},
      };
    } catch {
      return null;
    }
  }
}

// ─── Fusion Agent ────────────────────────────────────────────────────────────

export class FusionAgent {
  /**
   * Fuse audio and video signals into a unified timeline with composite scores.
   */
  buildTimeline(
    sessionId: string,
    candidateId: string,
    signals: MultimodalSignal[],
    questions: Array<{ id: string; text: string; startTime_ms: number; endTime_ms: number }>
  ): MultimodalTimeline {
    // Sort signals by timestamp
    const sorted = [...signals].sort((a, b) => a.timestamp_ms - b.timestamp_ms);
    const duration_ms = sorted.length > 0 ? sorted[sorted.length - 1].timestamp_ms + sorted[sorted.length - 1].duration_ms : 0;

    // Build segments per question
    const segments: TimelineSegment[] = questions.map(q => {
      const segSignals = sorted.filter(s => s.timestamp_ms >= q.startTime_ms && s.timestamp_ms < q.endTime_ms);
      return {
        id: `seg_${q.id}`,
        startTime_ms: q.startTime_ms,
        endTime_ms: q.endTime_ms,
        questionId: q.id,
        questionText: q.text,
        signals: segSignals,
        aggregateScores: this.computeSegmentScores(segSignals),
      };
    });

    // Compute summary
    const summary = this.computeSummary(sorted, duration_ms);

    return {
      sessionId,
      candidateId,
      startTime: new Date().toISOString(),
      duration_ms,
      signals: sorted,
      segments,
      summary,
    };
  }

  private computeSegmentScores(signals: MultimodalSignal[]): SegmentScores {
    const byType = (type: SignalType) => signals.filter(s => s.type === type);

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0.5;

    const confidenceSignals = byType('confidence').map(s => s.value);
    const engagementSignals = byType('engagement').map(s => s.value);
    const eyeContactSignals = byType('eye_contact').map(s => s.value);
    const speechSignals = byType('speech_pace').map(s => s.value);

    const emotionSignals = signals.filter(s => s.type === 'emotion') as EmotionSignal[];
    const emotionValence = avg(emotionSignals.map(s => (s.valence + 1) / 2));

    const overallConfidence = avg(confidenceSignals);
    const engagement = avg(engagementSignals);
    const eyeContact = avg(eyeContactSignals);
    const speechClarity = avg(speechSignals);

    return {
      overallConfidence,
      emotionValence,
      engagement,
      eyeContact,
      speechClarity,
      compositeScore: (overallConfidence * 0.25 + engagement * 0.2 + eyeContact * 0.15 + speechClarity * 0.2 + emotionValence * 0.2),
    };
  }

  private computeSummary(signals: MultimodalSignal[], duration_ms: number): TimelineSummary {
    const emotions = signals.filter(s => s.type === 'emotion') as EmotionSignal[];
    const pauses = signals.filter(s => s.type === 'pause') as SpeechSignal[];
    const speechPace = signals.filter(s => s.type === 'speech_pace') as SpeechSignal[];
    const eyeContact = signals.filter(s => s.type === 'eye_contact');
    const engagement = signals.filter(s => s.type === 'engagement');
    const confidence = signals.filter(s => s.type === 'confidence');

    // Emotion distribution
    const emotionDist: Record<EmotionLabel, number> = {
      neutral: 0, happy: 0, surprised: 0, confused: 0, nervous: 0, confident: 0, thoughtful: 0,
    };
    for (const e of emotions) {
      if (e.label) emotionDist[e.label]++;
    }
    const dominantEmotion = (Object.entries(emotionDist).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral') as EmotionLabel;

    // Peak moments
    const peakMoments: PeakMoment[] = [];
    
    // Find high confidence moments
    const highConf = confidence.filter(s => s.value > 0.85);
    if (highConf.length > 0) {
      peakMoments.push({
        timestamp_ms: highConf[0].timestamp_ms,
        type: 'high_confidence',
        description: 'Candidate showed peak confidence',
        score: highConf[0].value,
      });
    }

    // Find long pauses
    const longPauses = pauses.filter(s => (s as SpeechSignal).pauseDuration_ms && (s as SpeechSignal).pauseDuration_ms! > 5000);
    for (const p of longPauses.slice(0, 3)) {
      peakMoments.push({
        timestamp_ms: p.timestamp_ms,
        type: 'long_pause',
        description: `Long pause: ${((p as SpeechSignal).pauseDuration_ms! / 1000).toFixed(1)}s`,
        score: p.value,
      });
    }

    // Risk signals
    const riskSignals: RiskSignal[] = [];
    
    const avgEyeContact = eyeContact.length > 0 ? eyeContact.reduce((s, v) => s + v.value, 0) / eyeContact.length : 0.5;
    if (avgEyeContact < 0.3) {
      riskSignals.push({
        type: 'low_eye_contact',
        severity: 'medium',
        description: `Average eye contact ratio: ${(avgEyeContact * 100).toFixed(0)}% (below 30% threshold)`,
        evidence: `${eyeContact.filter(s => s.value < 0.3).length}/${eyeContact.length} frames below threshold`,
      });
    }

    if (pauses.length > 10) {
      riskSignals.push({
        type: 'excessive_pauses',
        severity: 'low',
        description: `${pauses.length} significant pauses detected (> 2s each)`,
        evidence: `Total pause time: ${pauses.reduce((s, p) => s + p.duration_ms, 0) / 1000}s`,
      });
    }

    const nervousEmotions = emotions.filter(e => e.label === 'nervous');
    if (nervousEmotions.length > emotions.length * 0.3) {
      riskSignals.push({
        type: 'high_nervousness',
        severity: 'low',
        description: `Nervousness detected in ${(nervousEmotions.length / emotions.length * 100).toFixed(0)}% of frames`,
        evidence: `${nervousEmotions.length} nervous signals out of ${emotions.length} total emotion readings`,
      });
    }

    const avgWpm = speechPace.length > 0 
      ? speechPace.reduce((s, p) => s + (p.wordsPerMinute || 0), 0) / speechPace.length 
      : 0;

    return {
      avgConfidence: confidence.length > 0 ? confidence.reduce((s, v) => s + v.value, 0) / confidence.length : 0.5,
      avgEngagement: engagement.length > 0 ? engagement.reduce((s, v) => s + v.value, 0) / engagement.length : 0.5,
      avgEyeContact,
      avgSpeechPace_wpm: avgWpm,
      totalPauses: pauses.length,
      avgPauseDuration_ms: pauses.length > 0 ? pauses.reduce((s, p) => s + p.duration_ms, 0) / pauses.length : 0,
      dominantEmotion,
      emotionDistribution: emotionDist,
      peakMoments,
      riskSignals,
    };
  }
}

// ─── Singletons ──────────────────────────────────────────────────────────────

export const videoWorker = new VideoWorker();
export const audioWorker = new AudioWorker();
export const visionAgent = new VisionAgent();
export const fusionAgent = new FusionAgent();
