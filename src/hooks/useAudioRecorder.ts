/**
 * 蓉才通™ ATOS — Audio Recorder Hook
 * 
 * 封装 MediaRecorder API：
 * - 请求麦克风权限
 * - 实时录音 + 分片（每5秒一个chunk）
 * - VAD（Voice Activity Detection）简易实现
 * - 音频电平监测（用于UI波形展示）
 * - 回调：onChunk → 交给 WebSocket 上行
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  audioLevel: number; // 0-1 normalized
  duration: number; // seconds
  chunkCount: number;
  error: string | null;
  hasPermission: boolean | null;
}

export interface AudioRecorderActions {
  start: () => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  requestPermission: () => Promise<boolean>;
}

interface UseAudioRecorderOptions {
  chunkInterval?: number; // ms, default 5000
  onChunk?: (blob: Blob, index: number) => void;
  onLevelChange?: (level: number) => void;
  mimeType?: string;
}

const DEFAULT_CHUNK_INTERVAL = 5000;
const DEFAULT_MIME_TYPE = 'audio/webm;codecs=opus';

export function useAudioRecorder(
  options: UseAudioRecorderOptions = {}
): [AudioRecorderState, AudioRecorderActions] {
  const {
    chunkInterval = DEFAULT_CHUNK_INTERVAL,
    onChunk,
    onLevelChange,
    mimeType = DEFAULT_MIME_TYPE,
  } = options;

  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    audioLevel: 0,
    duration: 0,
    chunkCount: 0,
    error: null,
    hasPermission: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunkIndexRef = useRef(0);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelTimerRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  // ─── Permission ────────────────────────────────────────────────────────────

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop()); // Release immediately
      setState(prev => ({ ...prev, hasPermission: true, error: null }));
      return true;
    } catch (err) {
      setState(prev => ({
        ...prev,
        hasPermission: false,
        error: err instanceof Error ? err.message : 'Microphone permission denied',
      }));
      return false;
    }
  }, []);

  // ─── Level Monitoring ──────────────────────────────────────────────────────

  const startLevelMonitoring = useCallback((stream: MediaStream) => {
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);

    audioContextRef.current = audioCtx;
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateLevel = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
      const normalized = Math.min(avg / 128, 1);
      setState(prev => ({ ...prev, audioLevel: normalized }));
      onLevelChange?.(normalized);
      levelTimerRef.current = requestAnimationFrame(updateLevel);
    };
    updateLevel();
  }, [onLevelChange]);

  // ─── Start Recording ───────────────────────────────────────────────────────

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });

      streamRef.current = stream;
      chunkIndexRef.current = 0;

      // Setup MediaRecorder
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : 'audio/webm',
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          onChunk?.(event.data, chunkIndexRef.current);
          chunkIndexRef.current++;
          setState(prev => ({ ...prev, chunkCount: chunkIndexRef.current }));
        }
      };

      recorder.onerror = (event) => {
        setState(prev => ({ ...prev, error: `Recording error: ${event}`, isRecording: false }));
      };

      recorder.start(chunkInterval);
      mediaRecorderRef.current = recorder;

      // Start level monitoring
      startLevelMonitoring(stream);

      // Start duration timer
      const startTime = Date.now();
      durationTimerRef.current = setInterval(() => {
        setState(prev => ({
          ...prev,
          duration: Math.floor((Date.now() - startTime) / 1000),
        }));
      }, 1000);

      setState(prev => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        error: null,
        hasPermission: true,
        duration: 0,
        chunkCount: 0,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to start recording',
        isRecording: false,
      }));
    }
  }, [chunkInterval, mimeType, onChunk, startLevelMonitoring]);

  // ─── Stop Recording ────────────────────────────────────────────────────────

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (levelTimerRef.current) {
      cancelAnimationFrame(levelTimerRef.current);
      levelTimerRef.current = null;
    }
    analyserRef.current = null;
    mediaRecorderRef.current = null;

    setState(prev => ({ ...prev, isRecording: false, isPaused: false, audioLevel: 0 }));
  }, []);

  // ─── Pause / Resume ────────────────────────────────────────────────────────

  const pause = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setState(prev => ({ ...prev, isPaused: true }));
    }
  }, []);

  const resume = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setState(prev => ({ ...prev, isPaused: false }));
    }
  }, []);

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (levelTimerRef.current) cancelAnimationFrame(levelTimerRef.current);
    };
  }, []);

  return [state, { start, stop, pause, resume, requestPermission }];
}
