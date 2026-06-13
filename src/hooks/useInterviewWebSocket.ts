/**
 * 蓉才通™ ATOS — Interview WebSocket Hook
 * 
 * 封装与后端 Interview Agent Pipeline 的实时双向通信：
 * - 连接管理（自动重连 + 心跳）
 * - 音频流上行（MediaRecorder → WebSocket）
 * - Agent 事件下行（transcript/score/followup/star/competency）
 * - 会话状态同步
 */
import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TranscriptEntry {
  id: string;
  timestamp: string;
  speaker: 'candidate' | 'interviewer' | 'system';
  text: string;
  confidence?: number;
}

export interface STARDetection {
  completeness: number;
  missingDimensions: string[];
  overallScore: number;
  suggestedFollowup?: string;
}

export interface CompetencySignal {
  competency: string;
  type: 'positive' | 'negative' | 'neutral';
  text: string;
  weight: number;
}

export interface ScoreUpdate {
  overall: number;
  dimensions: Array<{ name: string; score: number }>;
  recommendation?: string;
  confidence: number;
}

export interface FollowupSuggestion {
  question: string;
  strategy: string;
  targetCompetency: string;
  reasoning: string;
}

export interface InterviewWSState {
  connected: boolean;
  sessionId: string | null;
  transcript: TranscriptEntry[];
  scores: ScoreUpdate | null;
  starDetection: STARDetection | null;
  competencySignals: CompetencySignal[];
  followupSuggestions: FollowupSuggestion[];
  error: string | null;
}

export interface InterviewWSActions {
  connect: (sessionId: string) => void;
  disconnect: () => void;
  sendAudioChunk: (audioBlob: Blob, chunkIndex: number) => void;
  sendMessage: (type: string, data: unknown) => void;
}

// ─── Configuration ───────────────────────────────────────────────────────────

const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';
const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_ATTEMPTS = 5;
const HEARTBEAT_INTERVAL_MS = 30000;

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useInterviewWebSocket(): [InterviewWSState, InterviewWSActions] {
  const [state, setState] = useState<InterviewWSState>({
    connected: false,
    sessionId: null,
    transcript: [],
    scores: null,
    starDetection: null,
    competencySignals: [],
    followupSuggestions: [],
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // ─── Message Handler ─────────────────────────────────────────────────────

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data);
      const { type, data } = msg;

      switch (type) {
        case 'connected':
        case 'joined':
          setState(prev => ({ ...prev, connected: true, error: null }));
          break;

        case 'interview:transcript':
          setState(prev => ({
            ...prev,
            transcript: [...prev.transcript, data as TranscriptEntry],
          }));
          break;

        case 'interview:score_update':
          setState(prev => ({ ...prev, scores: data as ScoreUpdate }));
          break;

        case 'interview:star_detected':
          setState(prev => ({
            ...prev,
            starDetection: data?.analysis as STARDetection,
          }));
          break;

        case 'interview:competency_signal':
          setState(prev => ({
            ...prev,
            competencySignals: [
              ...prev.competencySignals.slice(-20), // Keep last 20
              ...(data?.signals || [data]) as CompetencySignal[],
            ],
          }));
          break;

        case 'interview:followup':
          setState(prev => ({
            ...prev,
            followupSuggestions: [
              ...prev.followupSuggestions.slice(-5),
              data as FollowupSuggestion,
            ],
          }));
          break;

        case 'interview:completed':
          setState(prev => ({ ...prev, connected: false }));
          break;

        case 'error':
          setState(prev => ({ ...prev, error: data?.message || 'Unknown error' }));
          break;

        default:
          // Unknown event type, log for debugging
          console.debug('[InterviewWS] Unknown event:', type, data);
      }
    } catch (err) {
      console.error('[InterviewWS] Message parse error:', err);
    }
  }, []);

  // ─── Connection Management ───────────────────────────────────────────────

  const connect = useCallback((sessionId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    sessionIdRef.current = sessionId;
    reconnectAttempts.current = 0;

    const url = `${WS_BASE_URL}/interview/${sessionId}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setState(prev => ({ ...prev, connected: true, sessionId, error: null }));
      reconnectAttempts.current = 0;

      // Start heartbeat
      heartbeatTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Join session
      ws.send(JSON.stringify({ type: 'join', role: 'interviewer', sessionId }));
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      setState(prev => ({ ...prev, connected: false }));
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);

      // Auto-reconnect
      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS && sessionIdRef.current) {
        reconnectAttempts.current++;
        setTimeout(() => {
          if (sessionIdRef.current) connect(sessionIdRef.current);
        }, RECONNECT_DELAY_MS * reconnectAttempts.current);
      }
    };

    ws.onerror = (err) => {
      console.error('[InterviewWS] Connection error:', err);
      setState(prev => ({ ...prev, error: 'WebSocket connection failed' }));
    };

    wsRef.current = ws;
  }, [handleMessage]);

  const disconnect = useCallback(() => {
    sessionIdRef.current = null;
    if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
    setState(prev => ({ ...prev, connected: false, sessionId: null }));
  }, []);

  // ─── Audio Streaming ─────────────────────────────────────────────────────

  const sendAudioChunk = useCallback((audioBlob: Blob, chunkIndex: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      wsRef.current?.send(JSON.stringify({
        type: 'audio_chunk',
        data: {
          audio: base64,
          format: 'webm',
          chunkIndex,
        },
      }));
    };
    reader.readAsDataURL(audioBlob);
  }, []);

  // ─── Generic Message ─────────────────────────────────────────────────────

  const sendMessage = useCallback((type: string, data: unknown) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type, data }));
  }, []);

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      sessionIdRef.current = null;
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return [state, { connect, disconnect, sendAudioChunk, sendMessage }];
}
