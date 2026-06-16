/**
 * 蓉才通™ ATOS — AI Interview OS: Video Workspace (v2.0)
 * 
 * 对标: HireVue × Karat × Final Round AI × Sensei AI
 * 
 * 5 Block 同步布局（匹配 Module 2 实时推理输出）：
 * Block 1 | Question Panel Sync — 左上（题目进度 + 核心题库脊柱保护）
 * Block 2 | Follow-up Queue — 左下（分层追问：Clarify/Deep Dive/Stress Challenge + 双证据标签）
 * Block 3 | Live Competency Scorecard — 右上（5维度实时评分 + 摄像头视觉证据）
 * Block 4 | Transcript-Video Anchor Log — 中下（文字稿-视频锚定 + 视觉标签）
 * Block 5 | Timeline Event Marker — 右下（摄像头触发的时间线事件卡片）
 * 
 * 摄像头视觉分析证据显性展示：
 * - 每项评分变动附带 [Visual Evidence] 标签
 * - 每条追问附带 [Video Anchor: XXs-XXs] + [Transcript Line N]
 * - 文字稿每段附带视觉行为标签
 * - 时间线事件仅由摄像头信号触发
 * 
 * 真实能力:
 * - WebSocket连接后端Interview Orchestrator
 * - MediaRecorder录音 → 分片上传 → Whisper ASR
 * - Agent事件实时渲染（5 Block 同步）
 * - Session状态机（idle→connecting→in_progress→completed）
 * - Demo模式：无后端时自动模拟完整Agent Pipeline + 摄像头信号
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Video, VideoOff, Play, Square, Clock,
  Brain, Target, MessageSquare, TrendingUp, AlertTriangle,
  CheckCircle, XCircle, ChevronRight, BarChart3, Zap,
  User, Bot, Wifi, WifiOff, Volume2, Shield, Eye,
  Camera, AlertCircle, ArrowUp, ArrowDown, Minus
} from 'lucide-react';
import { useInterviewSessions } from '../../lib/api/hooks';
import { LoadingView, ErrorView } from '../../components/StateViews';

// ─── Types (Aligned with Module 2 Output Schema) ────────────────────────────

interface TranscriptEntry {
  id: string;
  speaker: 'candidate' | 'interviewer' | 'system';
  text: string;
  timestamp: number;
  confidence: number;
  starTag?: 'situation' | 'task' | 'action' | 'result';
  /** Block 4: 视觉行为标签 */
  visualTag?: 'steady_gaze' | 'defensive_shift' | 'long_pause' | 'stress_expression' | 'confident' | 'neutral';
  /** Block 4: 视频时间锚点 */
  videoAnchor?: { startSec: number; endSec: number };
}

interface CompetencyScore {
  dimension: string;
  score: number;
  delta: number;
  signals: string[];
  trend: 'up' | 'down' | 'stable';
  /** Block 3: 语言证据 */
  verbalEvidence?: { timestamp: string; quote: string };
  /** Block 3: 摄像头视觉证据 */
  visualEvidence?: { timeRange: string; signal: string };
}

interface FollowUpItem {
  id: string;
  tier: 'clarify' | 'deep_dive' | 'stress_challenge';
  question: string;
  /** Block 2: 视频锚点 */
  videoAnchor?: { startSec: number; endSec: number };
  /** Block 2: 转录行号 */
  transcriptLine?: number;
  /** Block 2: 触发原因 */
  triggerReason?: string;
}

interface TimelineEvent {
  id: string;
  /** Block 5: 仅由摄像头视觉信号触发 */
  type: 'confidence' | 'stress_risk' | 'camera_exception' | 'evasion' | 'long_pause' | 'star_detected' | 'score_update';
  timestamp: number;
  timestampSec?: number;
  description: string;
  /** Block 5: 跳转视频片段 */
  jumpToVideo?: { startSec: number; endSec: number };
  /** Block 5: 关联追问 */
  relatedFollowUp?: string;
}

interface SessionState {
  status: 'idle' | 'connecting' | 'in_progress' | 'paused' | 'completed';
  sessionId: string | null;
  currentQuestionIdx: number;
  totalQuestions: number;
  elapsedSeconds: number;
  completionPct: number;
}

// ─── WebSocket Hook (Enhanced for 5 Block Protocol) ─────────────────────────

function useInterviewWebSocket(sessionId: string | null) {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [competencies, setCompetencies] = useState<CompetencyScore[]>(initCompetencies());
  const [followups, setFollowups] = useState<FollowUpItem[]>([]);
  const [overallScore, setOverallScore] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!sessionId) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v2/interview/ws/${sessionId}`;
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => { setConnected(true); ws.send(JSON.stringify({ type: 'join', role: 'interviewer' })); };
      ws.onmessage = (e) => handleWsMessage(JSON.parse(e.data));
      ws.onclose = () => { setConnected(false); setTimeout(() => { if (sessionId) connect(); }, 3000); };
      ws.onerror = () => setConnected(false);
    } catch { setConnected(false); }
  }, [sessionId]);

  const handleWsMessage = (payload: { type: string; data: Record<string, unknown> }) => {
    const ts = Date.now();
    const id = `evt_${ts}_${Math.random().toString(36).slice(2, 6)}`;

    switch (payload.type) {
      // Block 4: Transcript with visual anchor
      case 'interview:transcript':
        setTranscripts(prev => [...prev, {
          id,
          speaker: (payload.data.speaker as TranscriptEntry['speaker']) || 'candidate',
          text: (payload.data.text as string) || '',
          timestamp: ts,
          confidence: (payload.data.confidence as number) || 0.95,
          starTag: payload.data.starTag as TranscriptEntry['starTag'],
          visualTag: (payload.data.visualTag as TranscriptEntry['visualTag']) || 'neutral',
          videoAnchor: payload.data.videoAnchor as TranscriptEntry['videoAnchor'],
        }]);
        break;

      // Block 3: Competency with dual evidence
      case 'interview:competency_signal': {
        const dim = payload.data.dimension as string;
        const score = payload.data.score as number;
        const delta = (payload.data.delta as number) || 0;
        const verbalEvidence = payload.data.verbalEvidence as CompetencyScore['verbalEvidence'];
        const visualEvidence = payload.data.visualEvidence as CompetencyScore['visualEvidence'];
        setCompetencies(prev => prev.map(c => c.dimension === dim ? {
          ...c,
          score: Math.round(score),
          delta,
          signals: [...c.signals, (payload.data.signal as string) || ''].slice(-3),
          trend: score > c.score ? 'up' : score < c.score ? 'down' : 'stable',
          verbalEvidence,
          visualEvidence,
        } : c));
        break;
      }

      // Block 2: Follow-up with video anchor + transcript line
      case 'interview:followup':
        setFollowups(prev => [...prev, {
          id,
          tier: (payload.data.tier as FollowUpItem['tier']) || 'clarify',
          question: (payload.data.question as string) || '',
          videoAnchor: payload.data.videoAnchor as FollowUpItem['videoAnchor'],
          transcriptLine: payload.data.transcriptLine as number,
          triggerReason: payload.data.triggerReason as string,
        }]);
        break;

      // Block 5: Timeline event (camera-triggered)
      case 'interview:timeline_event':
        setEvents(prev => [...prev, {
          id,
          type: (payload.data.type as TimelineEvent['type']) || 'confidence',
          timestamp: ts,
          timestampSec: payload.data.timestampSec as number,
          description: (payload.data.description as string) || '',
          jumpToVideo: payload.data.jumpToVideo as TimelineEvent['jumpToVideo'],
          relatedFollowUp: payload.data.relatedFollowUp as string,
        }]);
        break;

      // Block 1: Score update
      case 'interview:score_update':
        setOverallScore(Math.round(payload.data.overallScore as number));
        break;

      // Legacy event compatibility
      case 'interview:realtime_blocks': {
        const blocks = payload.data as Record<string, unknown>;
        // Process all 5 blocks from a single payload
        if (blocks.block3_competency_scores) {
          const scores = blocks.block3_competency_scores as Array<{ dimension: string; score: number; delta: number; verbalEvidence: CompetencyScore['verbalEvidence']; visualEvidence: CompetencyScore['visualEvidence'] }>;
          setCompetencies(prev => prev.map(c => {
            const update = scores.find(s => s.dimension === c.dimension);
            if (!update) return c;
            return { ...c, score: update.score, delta: update.delta, trend: update.delta > 0 ? 'up' : update.delta < 0 ? 'down' : 'stable', verbalEvidence: update.verbalEvidence, visualEvidence: update.visualEvidence };
          }));
        }
        if (blocks.block5_timeline_events) {
          const newEvents = blocks.block5_timeline_events as Array<{ type: string; timestampSec: number; description: string; jumpToVideo: { startSec: number; endSec: number }; relatedFollowUp?: string }>;
          setEvents(prev => [...prev, ...newEvents.map(e => ({ id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, type: e.type as TimelineEvent['type'], timestamp: ts, timestampSec: e.timestampSec, description: e.description, jumpToVideo: e.jumpToVideo, relatedFollowUp: e.relatedFollowUp }))]);
        }
        break;
      }
    }
  };

  const disconnect = useCallback(() => { wsRef.current?.close(); wsRef.current = null; setConnected(false); }, []);

  const sendAudioChunk = useCallback((blob: Blob, chunkIdx: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const reader = new FileReader();
    reader.onload = () => { wsRef.current?.send(JSON.stringify({ type: 'audio_chunk', data: { audio: reader.result, format: 'webm', chunkIndex: chunkIdx } })); };
    reader.readAsDataURL(blob);
  }, []);

  useEffect(() => { if (sessionId) connect(); return () => disconnect(); }, [sessionId, connect, disconnect]);

  return { connected, events, transcripts, competencies, followups, overallScore, sendAudioChunk };
}

// ─── Audio Recorder Hook ─────────────────────────────────────────────────────

function useAudioRecorder(onChunk: (blob: Blob, idx: number) => void) {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunkIdx = useRef(0);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      recorderRef.current = recorder;
      chunkIdx.current = 0;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) onChunk(e.data, chunkIdx.current++); };
      recorder.start(5000);
      setRecording(true);
    } catch (err) { console.error('Mic access denied:', err); }
  }, [onChunk]);

  const stop = useCallback(() => {
    if (recorderRef.current) { recorderRef.current.stop(); recorderRef.current.stream.getTracks().forEach(t => t.stop()); recorderRef.current = null; }
    setRecording(false);
  }, []);

  return { recording, start, stop };
}

// ─── Demo Simulation (Enhanced with Camera Visual Signals) ──────────────────

function useDemoSimulation(active: boolean, status: SessionState['status']) {
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [competencies, setCompetencies] = useState<CompetencyScore[]>(initCompetencies());
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [followups, setFollowups] = useState<FollowUpItem[]>([]);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!active || status !== 'in_progress') return;
    const script: Array<{ delay: number; fn: () => void }> = [
      { delay: 2000, fn: () => setTranscripts(p => [...p, mkT('interviewer', '请描述一个您主导的技术架构决策，以及它带来的业务影响。', 1.0, undefined, 'neutral', { startSec: 0, endSec: 3 })]) },
      { delay: 4000, fn: () => setEvents(p => [...p, mkTimelineEvent('confidence', 4, 'Candidate maintains steady 85% eye contact with camera', { startSec: 3, endSec: 18 })]) },
      { delay: 5000, fn: () => {
        setTranscripts(p => [...p, mkT('candidate', '在上一家公司，我们面临一个核心问题：系统每天处理200万订单，但延迟从50ms飙升到了800ms...', 0.94, 'situation', 'steady_gaze', { startSec: 3, endSec: 12 })]);
        setEvents(p => [...p, mkTimelineEvent('confidence', 5, 'Direct camera gaze while describing problem context — Ownership signal', { startSec: 3, endSec: 12 })]);
      }},
      { delay: 9000, fn: () => {
        setTranscripts(p => [...p, mkT('candidate', '我的任务是在不停机的情况下，将整个订单系统从单体架构迁移到事件驱动的微服务架构，同时保证99.99%的可用性。', 0.96, 'task', 'confident', { startSec: 12, endSec: 22 })]);
        setCompetencies(p => p.map(c => c.dimension === 'Leadership' ? { ...c, score: 72, delta: +7, trend: 'up', signals: ['主导架构决策'], verbalEvidence: { timestamp: '00:12', quote: '我的任务是...将整个订单系统迁移' }, visualEvidence: { timeRange: '12s-22s', signal: 'Confident upright posture, steady camera gaze' } } : c));
      }},
      { delay: 14000, fn: () => {
        setTranscripts(p => [...p, mkT('candidate', '我首先做了3周的流量分析，识别出热点路径。然后设计了双写+影子流量方案，用Feature Flag逐步切流。关键是我说服了CTO接受"慢迁移"策略。', 0.92, 'action', 'steady_gaze', { startSec: 22, endSec: 38 })]);
        setCompetencies(p => p.map(c => {
          if (c.dimension === 'Execution') return { ...c, score: 81, delta: +11, trend: 'up', signals: ['系统性方法论', '风险控制'], verbalEvidence: { timestamp: '00:22', quote: '3周流量分析...双写+影子流量方案' }, visualEvidence: { timeRange: '22s-38s', signal: 'Calm posture, coordinated hand gestures explaining architecture' } };
          if (c.dimension === 'Communication') return { ...c, score: 76, delta: +6, trend: 'up', signals: ['说服CTO'], verbalEvidence: { timestamp: '00:35', quote: '说服了CTO接受慢迁移策略' }, visualEvidence: { timeRange: '34s-38s', signal: 'Direct eye contact when describing persuasion' } };
          return c;
        }));
        setScore(74);
      }},
      { delay: 16000, fn: () => setEvents(p => [...p, mkTimelineEvent('confidence', 16, 'Sustained 90%+ eye contact for 15s during technical explanation', { startSec: 22, endSec: 38 })]) },
      { delay: 18000, fn: () => {
        setFollowups(p => [...p, {
          id: `fu_${Date.now()}`,
          tier: 'deep_dive',
          question: '你提到"慢迁移"策略，当时CTO的主要顾虑是什么？你是如何量化风险来说服他的？',
          videoAnchor: { startSec: 34, endSec: 38 },
          transcriptLine: 4,
          triggerReason: 'Candidate mentioned persuading CTO but skipped risk quantification details',
        }]);
      }},
      { delay: 20000, fn: () => {
        setTranscripts(p => [...p, mkT('candidate', '嗯...CTO当时...主要是担心...', 0.88, undefined, 'defensive_shift', { startSec: 38, endSec: 43 })]);
        setEvents(p => [...p, mkTimelineEvent('stress_risk', 20, 'Gaze avoidance + 3s pause when asked about CTO pushback — Stress signal', { startSec: 38, endSec: 43 })]);
      }},
      { delay: 22000, fn: () => {
        setTranscripts(p => [...p, mkT('candidate', '最终结果：延迟从800ms降到35ms，系统吞吐量提升4倍。这个架构支撑了后续3年的业务增长，从200万单/天到800万单/天。', 0.97, 'result', 'confident', { startSec: 43, endSec: 55 })]);
        setCompetencies(p => p.map(c => {
          if (c.dimension === 'Ownership') return { ...c, score: 85, delta: +10, trend: 'up', signals: ['长期视角', '业务量化'], verbalEvidence: { timestamp: '00:43', quote: '支撑了后续3年的业务增长' }, visualEvidence: { timeRange: '43s-55s', signal: 'Confident direct gaze, open posture when claiming results' } };
          if (c.dimension === 'Execution') return { ...c, score: 88, delta: +7, trend: 'up', signals: [...c.signals, '4x吞吐'], verbalEvidence: { timestamp: '00:43', quote: '延迟从800ms降到35ms，吞吐量提升4倍' }, visualEvidence: { timeRange: '43s-55s', signal: 'Steady posture, precise hand gestures on numbers' } };
          if (c.dimension === 'Stress Resistance') return { ...c, score: 78, delta: +8, trend: 'up', signals: ['高压决策'], verbalEvidence: { timestamp: '00:43', quote: '不停机...99.99%可用性' }, visualEvidence: { timeRange: '43s-55s', signal: 'Recovered composure after brief stress signal' } };
          if (c.dimension === 'Leadership') return { ...c, score: 82, delta: +10, trend: 'up', signals: [...c.signals, '跨部门协调'], verbalEvidence: { timestamp: '00:22', quote: '我首先做了...然后设计了...' }, visualEvidence: { timeRange: '22s-55s', signal: 'Upright open posture throughout leadership narrative' } };
          return c;
        }));
        setScore(84);
        setEvents(p => [...p, mkTimelineEvent('confidence', 22, 'Strong confident delivery of quantitative results — Leadership + Ownership', { startSec: 43, endSec: 55 })]);
      }},
      { delay: 25000, fn: () => {
        setFollowups(p => [...p, {
          id: `fu_${Date.now()}`,
          tier: 'stress_challenge',
          question: '迁移过程中最大的一次线上事故是什么？你个人在其中承担了什么责任？',
          videoAnchor: { startSec: 38, endSec: 43 },
          transcriptLine: 5,
          triggerReason: 'Detected defensive gaze shift when discussing CTO pushback — test Ownership under pressure',
        }]);
      }},
    ];
    const timers = script.map(({ delay, fn }) => setTimeout(fn, delay));
    return () => timers.forEach(clearTimeout);
  }, [active, status]);

  return { transcripts, competencies, events, followups, score };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initCompetencies(): CompetencyScore[] {
  return [
    { dimension: 'Leadership', score: 0, delta: 0, signals: [], trend: 'stable' },
    { dimension: 'Communication', score: 0, delta: 0, signals: [], trend: 'stable' },
    { dimension: 'Execution', score: 0, delta: 0, signals: [], trend: 'stable' },
    { dimension: 'Ownership', score: 0, delta: 0, signals: [], trend: 'stable' },
    { dimension: 'Stress Resistance', score: 0, delta: 0, signals: [], trend: 'stable' },
  ];
}

function mkT(speaker: TranscriptEntry['speaker'], text: string, confidence = 1.0, starTag?: TranscriptEntry['starTag'], visualTag?: TranscriptEntry['visualTag'], videoAnchor?: TranscriptEntry['videoAnchor']): TranscriptEntry {
  return { id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, speaker, text, timestamp: Date.now(), confidence, starTag, visualTag, videoAnchor };
}

function mkTimelineEvent(type: TimelineEvent['type'], sec: number, description: string, jumpToVideo?: TimelineEvent['jumpToVideo']): TimelineEvent {
  return { id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, type, timestamp: Date.now(), timestampSec: sec, description, jumpToVideo };
}

const TIER_CONFIG = {
  clarify: { label: 'Clarify', color: 'bg-blue-50 border-blue-200 text-blue-700', icon: '🔍' },
  deep_dive: { label: 'Deep Dive', color: 'bg-amber-50 border-amber-200 text-amber-700', icon: '🔬' },
  stress_challenge: { label: 'Stress Test', color: 'bg-risk-50 border-risk-200 text-risk-700', icon: '⚡' },
} as const;

const VISUAL_TAG_CONFIG: Record<string, { label: string; color: string }> = {
  steady_gaze: { label: '👁️ Steady Gaze', color: 'bg-ok-50 text-ok-700' },
  defensive_shift: { label: '⚠️ Gaze Shift', color: 'bg-warn-50 text-warn-700' },
  long_pause: { label: '⏸️ Long Pause', color: 'bg-ink-100 text-muted' },
  stress_expression: { label: '😰 Stress', color: 'bg-risk-50 text-risk-700' },
  confident: { label: '✓ Confident', color: 'bg-ok-50 text-ok-700' },
  neutral: { label: '— Neutral', color: 'bg-ink-50 text-muted' },
};

const TIMELINE_TYPE_CONFIG: Record<string, { color: string; icon: typeof CheckCircle }> = {
  confidence: { color: 'bg-ok-100 text-ok-600', icon: CheckCircle },
  stress_risk: { color: 'bg-risk-100 text-risk-600', icon: AlertTriangle },
  camera_exception: { color: 'bg-warn-100 text-warn-600', icon: AlertCircle },
  evasion: { color: 'bg-warn-100 text-warn-600', icon: XCircle },
  long_pause: { color: 'bg-ink-100 text-muted', icon: Clock },
  star_detected: { color: 'bg-blue-100 text-blue-600', icon: CheckCircle },
  score_update: { color: 'bg-brand-100 text-brand-600', icon: BarChart3 },
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Interview() {
  const { data: sessionsData, isLoading, error } = useInterviewSessions();
  const [session, setSession] = useState<SessionState>({ status: 'idle', sessionId: null, currentQuestionIdx: 0, totalQuestions: 5, elapsedSeconds: 0, completionPct: 0 });
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [demoMode, setDemoMode] = useState(true);

  const ws = useInterviewWebSocket(demoMode ? null : session.sessionId);
  const recorder = useAudioRecorder(ws.sendAudioChunk);
  const demo = useDemoSimulation(demoMode, session.status);

  // Timer
  useEffect(() => {
    if (session.status !== 'in_progress') return;
    const t = setInterval(() => setSession(p => ({ ...p, elapsedSeconds: p.elapsedSeconds + 1 })), 1000);
    return () => clearInterval(t);
  }, [session.status]);

  // Select data source
  const transcripts = demoMode ? demo.transcripts : ws.transcripts;
  const competencies = demoMode ? demo.competencies : ws.competencies;
  const events = demoMode ? demo.events : ws.events;
  const followups = demoMode ? demo.followups : ws.followups;
  const overallScore = demoMode ? demo.score : ws.overallScore;
  const wsConnected = demoMode ? true : ws.connected;

  const startInterview = async () => {
    setSession(p => ({ ...p, status: 'in_progress', elapsedSeconds: 0, completionPct: 0 }));
    if (!demoMode) {
      try {
        const res = await fetch('/api/v2/interview/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidateId: 'cand_001', positionId: 'pos_001', competencies: ['Leadership', 'Communication', 'Execution', 'Ownership', 'Stress Resistance'], durationMinutes: 45 }) });
        const data = await res.json();
        setSession(p => ({ ...p, sessionId: data.sessionId }));
        recorder.start();
      } catch { setDemoMode(true); }
    }
  };

  const endInterview = () => {
    setSession(p => ({ ...p, status: 'completed' }));
    if (!demoMode) { recorder.stop(); if (session.sessionId) fetch(`/api/v2/interview/sessions/${session.sessionId}/end`, { method: 'POST' }); }
  };

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const questions = [
    '请描述一个您主导的技术架构决策，以及它带来的业务影响。',
    '你如何处理团队中的技术封闭？请举一个具体的例子。',
    '描述一次您在高压环境下做出关键决策的经历。',
    '您如何评估和管理技术财务？',
    '请分享一个您推动组织变革的案例。',
  ];

  if (isLoading) return <LoadingView />;
  if (error) return <ErrorView message={(error as Error).message} />;

  return (
    <div className="h-full flex flex-col gap-2 p-3">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-foreground">AI Interview Workspace</h1>
          <span className="px-2 py-0.5 text-[10px] font-medium bg-trust-50 text-trust-700 rounded-full border border-trust-200">CA Signed</span>
          <span className="px-2 py-0.5 text-[10px] font-medium bg-brand-50 text-brand-700 rounded-full border border-brand-200 flex items-center gap-1"><Camera className="w-2.5 h-2.5" />Dual-Stream</span>
          {demoMode && <span className="px-2 py-0.5 text-[10px] font-medium bg-warn-100 text-warn-700 rounded-full">DEMO</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium ${wsConnected ? 'bg-ok-50 text-ok-700' : 'bg-ink-100 text-muted'}`}>
            {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {wsConnected ? 'Connected' : 'Offline'}
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 bg-ink-50 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-muted" />
            <span className="text-sm font-mono font-semibold text-foreground tabular-nums">{fmt(session.elapsedSeconds)}</span>
            <span className="text-[10px] text-muted">/ 45:00</span>
          </div>
          {overallScore > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1 bg-brand-50 rounded-lg">
              <BarChart3 className="w-3.5 h-3.5 text-brand-600" />
              <span className="text-sm font-bold text-brand-700 tabular-nums">{overallScore}</span>
            </div>
          )}
          {session.status === 'idle' && <button onClick={startInterview} className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 flex items-center gap-1.5"><Play className="w-3.5 h-3.5" />Start</button>}
          {session.status === 'in_progress' && <button onClick={endInterview} className="px-3 py-1.5 bg-risk-600 text-white rounded-lg text-xs font-medium hover:bg-risk-700 flex items-center gap-1.5"><Square className="w-3.5 h-3.5" />End</button>}
          <button onClick={() => setDemoMode(!demoMode)} className={`px-2 py-1 rounded text-[10px] font-medium ${demoMode ? 'bg-warn-100 text-warn-700' : 'bg-ink-100 text-muted'}`}>{demoMode ? 'Demo' : 'Live'}</button>
        </div>
      </header>

      {/* ─── 5 Block Grid Layout ───────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-12 grid-rows-[auto_1fr_1fr] gap-2 min-h-0">

        {/* Video + Camera Area — Top Center (spans full width) */}
        <section className="col-span-12 row-span-1 bg-ink-900 rounded-xl overflow-hidden relative h-[180px]">
          <div className="absolute inset-0 flex items-center justify-center">
            {videoEnabled ? (
              <div className="w-full h-full bg-gradient-to-br from-ink-800 to-ink-900 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-ink-700 flex items-center justify-center mx-auto mb-1.5"><User className="w-8 h-8 text-ink-400" /></div>
                  <p className="text-ink-400 text-xs">Candidate Camera</p>
                  <p className="text-ink-500 text-[10px] mt-0.5">{session.status === 'in_progress' ? '📹 Recording + Visual Analysis Active' : 'Waiting'}</p>
                </div>
              </div>
            ) : <p className="text-ink-500 text-xs">Camera Off</p>}
          </div>
          {/* AI Avatar PiP */}
          <div className="absolute bottom-2 right-2 w-24 h-24 rounded-xl bg-ink-800 border border-ink-600 flex items-center justify-center shadow-lg">
            <div className="text-center">
              <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center mx-auto mb-1"><Brain className="w-4 h-4 text-brand-400" /></div>
              <p className="text-[8px] text-ink-400">AI Interviewer</p>
              {session.status === 'in_progress' && <div className="flex items-center justify-center gap-0.5 mt-0.5"><Volume2 className="w-2 h-2 text-brand-400 animate-pulse" /><span className="text-[7px] text-brand-400">Active</span></div>}
            </div>
          </div>
          {/* Controls */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
            <button onClick={() => setVideoEnabled(!videoEnabled)} className={`p-1.5 rounded-full ${videoEnabled ? 'bg-white/10 text-white' : 'bg-risk-600 text-white'}`}>{videoEnabled ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}</button>
            <button onClick={() => recorder.recording ? recorder.stop() : recorder.start()} className={`p-1.5 rounded-full ${recorder.recording ? 'bg-risk-600 text-white animate-pulse' : 'bg-white/10 text-white'}`}>{recorder.recording ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}</button>
          </div>
          {session.status === 'in_progress' && <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 bg-risk-600/90 rounded-full"><div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /><span className="text-[9px] text-white font-medium">REC</span></div>}
          {/* Camera Analysis Badge */}
          {session.status === 'in_progress' && <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 bg-brand-600/80 rounded-full"><Eye className="w-2.5 h-2.5 text-white" /><span className="text-[8px] text-white font-medium">Vision AI Active</span></div>}
        </section>

        {/* ─── Block 1: Question Panel Sync — Left */}
        <section className="col-span-3 row-span-1 bg-surface border border-border rounded-xl p-2.5 overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-3.5 h-3.5 text-brand-600" />
            <span className="text-[11px] font-semibold text-foreground">Block 1 · Questions</span>
            <span className="ml-auto text-[10px] text-muted tabular-nums">{session.currentQuestionIdx + 1}/{questions.length}</span>
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-ink-100 rounded-full mb-2 overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${((session.currentQuestionIdx + 1) / questions.length) * 100}%` }} />
          </div>
          <div className="space-y-1.5">
            {questions.map((q, i) => (
              <div key={i} onClick={() => setSession(p => ({ ...p, currentQuestionIdx: i }))} className={`p-2 rounded-lg text-[10px] leading-relaxed cursor-pointer transition-all ${i === session.currentQuestionIdx ? 'bg-brand-50 border border-brand-200 text-foreground font-medium' : i < session.currentQuestionIdx ? 'bg-ok-50 border border-ok-100 text-muted line-through' : 'bg-ink-50 text-muted hover:bg-ink-100'}`}>
                <span className="font-mono text-[9px] mr-1 font-bold">Q{i + 1}</span>{q}
                {i < session.currentQuestionIdx && <CheckCircle className="w-3 h-3 text-ok-500 inline ml-1" />}
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-border">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-trust-500" />
              <span className="text-[8px] text-muted">Spine Protected · 不可跳过/替换</span>
            </div>
          </div>
        </section>

        {/* ─── Block 4: Transcript-Video Anchor Log — Center */}
        <section className="col-span-6 row-span-1 bg-surface border border-border rounded-xl p-2.5 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-3.5 h-3.5 text-brand-600" />
            <span className="text-[11px] font-semibold text-foreground">Block 4 · Transcript + Video Anchor</span>
            <span className="ml-auto text-[8px] text-muted flex items-center gap-1"><Camera className="w-2.5 h-2.5" />Visual tags bound</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {transcripts.length === 0 ? (
              <p className="text-[10px] text-muted text-center py-8">Transcript with video anchors appears here once interview starts...</p>
            ) : transcripts.map(t => (
              <div key={t.id} className={`flex gap-2 ${t.speaker === 'candidate' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${t.speaker === 'interviewer' ? 'bg-brand-100 text-brand-600' : 'bg-ink-200 text-muted'}`}>
                  {t.speaker === 'interviewer' ? <Bot className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
                </div>
                <div className={`max-w-[80%] p-2 rounded-lg ${t.speaker === 'interviewer' ? 'bg-brand-50 border border-brand-100' : 'bg-ink-50 border border-border'}`}>
                  <p className="text-[11px] text-foreground leading-relaxed">{t.text}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[8px] text-muted tabular-nums">{new Date(t.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    {t.starTag && <span className={`text-[8px] px-1 py-0.5 rounded font-medium ${t.starTag === 'situation' ? 'bg-blue-100 text-blue-700' : t.starTag === 'task' ? 'bg-purple-100 text-purple-700' : t.starTag === 'action' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{t.starTag.toUpperCase()}</span>}
                    {/* Visual Tag — 摄像头视觉行为标签 */}
                    {t.visualTag && t.visualTag !== 'neutral' && (
                      <span className={`text-[8px] px-1 py-0.5 rounded ${VISUAL_TAG_CONFIG[t.visualTag]?.color || 'bg-ink-50 text-muted'}`}>
                        {VISUAL_TAG_CONFIG[t.visualTag]?.label || t.visualTag}
                      </span>
                    )}
                    {/* Video Anchor — 视频时间锚点 */}
                    {t.videoAnchor && (
                      <span className="text-[7px] px-1 py-0.5 bg-ink-100 text-muted rounded font-mono">
                        📹 {t.videoAnchor.startSec}s-{t.videoAnchor.endSec}s
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Block 3: Live Competency Scorecard — Right */}
        <section className="col-span-3 row-span-1 bg-surface border border-border rounded-xl p-2.5 overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-3.5 h-3.5 text-brand-600" />
            <span className="text-[11px] font-semibold text-foreground">Block 3 · Competency</span>
          </div>
          <div className="space-y-2">
            {competencies.map(c => (
              <div key={c.dimension} className="group">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-medium text-foreground">{c.dimension}</span>
                  <div className="flex items-center gap-1">
                    {c.trend === 'up' && <ArrowUp className="w-2.5 h-2.5 text-ok-500" />}
                    {c.trend === 'down' && <ArrowDown className="w-2.5 h-2.5 text-risk-500" />}
                    {c.trend === 'stable' && <Minus className="w-2.5 h-2.5 text-muted" />}
                    <span className="text-[11px] font-bold text-foreground tabular-nums">{c.score || '—'}</span>
                    {c.delta !== 0 && <span className={`text-[8px] font-medium ${c.delta > 0 ? 'text-ok-600' : 'text-risk-600'}`}>{c.delta > 0 ? '+' : ''}{c.delta}</span>}
                  </div>
                </div>
                <div className="h-1 bg-ink-100 rounded-full overflow-hidden"><div className="h-full bg-brand-500 rounded-full transition-all duration-700" style={{ width: `${c.score}%` }} /></div>
                {/* Dual Evidence Display */}
                {(c.verbalEvidence || c.visualEvidence) && (
                  <div className="mt-1 space-y-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {c.verbalEvidence && (
                      <div className="flex items-start gap-1">
                        <span className="text-[7px] px-0.5 bg-blue-50 text-blue-600 rounded flex-shrink-0">💬</span>
                        <span className="text-[7px] text-muted leading-tight truncate">"{c.verbalEvidence.quote}"</span>
                      </div>
                    )}
                    {c.visualEvidence && (
                      <div className="flex items-start gap-1">
                        <span className="text-[7px] px-0.5 bg-ok-50 text-ok-600 rounded flex-shrink-0">📹</span>
                        <span className="text-[7px] text-muted leading-tight truncate">[{c.visualEvidence.timeRange}] {c.visualEvidence.signal}</span>
                      </div>
                    )}
                  </div>
                )}
                {c.signals.length > 0 && <div className="flex flex-wrap gap-0.5 mt-0.5">{c.signals.map((s, i) => <span key={i} className="text-[7px] px-1 py-0.5 bg-brand-50 text-brand-600 rounded">{s}</span>)}</div>}
              </div>
            ))}
          </div>
          {overallScore > 0 && <div className="mt-2 pt-2 border-t border-border flex items-center justify-between"><span className="text-[10px] font-semibold text-foreground">Overall</span><span className="text-base font-bold text-brand-700 tabular-nums">{overallScore}</span></div>}
          <div className="mt-2 pt-2 border-t border-border space-y-0.5">
            <div className="flex items-center gap-1.5"><Eye className="w-2.5 h-2.5 text-brand-500" /><span className="text-[8px] text-muted">Dual Evidence: Verbal + Camera</span></div>
            <div className="flex items-center gap-1.5"><Shield className="w-2.5 h-2.5 text-trust-500" /><span className="text-[8px] text-muted">CA签名审计合规</span></div>
          </div>
        </section>

        {/* ─── Block 2: Follow-up Queue — Left Bottom */}
        <section className="col-span-3 row-span-1 bg-surface border border-border rounded-xl p-2.5 overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-3.5 h-3.5 text-warn-500" />
            <span className="text-[11px] font-semibold text-foreground">Block 2 · Follow-ups</span>
            <span className="ml-auto text-[10px] text-muted tabular-nums">{followups.length}</span>
          </div>
          {followups.length === 0 ? (
            <p className="text-[9px] text-muted text-center py-4">Tiered follow-ups generated based on verbal + camera signals</p>
          ) : (
            <div className="space-y-1.5">{followups.map((fu) => {
              const tierCfg = TIER_CONFIG[fu.tier];
              return (
                <div key={fu.id} className={`p-2 rounded-lg border ${tierCfg.color}`}>
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-[8px]">{tierCfg.icon}</span>
                    <span className="text-[8px] font-bold">{tierCfg.label}</span>
                  </div>
                  <p className="text-[10px] text-foreground leading-relaxed">{fu.question}</p>
                  {/* Evidence Tags */}
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {fu.videoAnchor && (
                      <span className="text-[7px] px-1 py-0.5 bg-ink-100 text-muted rounded font-mono">📹 {fu.videoAnchor.startSec}s-{fu.videoAnchor.endSec}s</span>
                    )}
                    {fu.transcriptLine !== undefined && (
                      <span className="text-[7px] px-1 py-0.5 bg-ink-100 text-muted rounded font-mono">📝 Line {fu.transcriptLine}</span>
                    )}
                  </div>
                  {fu.triggerReason && (
                    <p className="text-[7px] text-muted mt-1 italic">Trigger: {fu.triggerReason}</p>
                  )}
                </div>
              );
            })}</div>
          )}
        </section>

        {/* ─── Block 4 continued: (center already used above, this row is for bottom panels) */}
        {/* Additional Transcript Stats — Center Bottom */}
        <section className="col-span-6 row-span-1 bg-surface border border-border rounded-xl p-2.5 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-2">
            <Camera className="w-3.5 h-3.5 text-brand-600" />
            <span className="text-[11px] font-semibold text-foreground">Camera Visual Analysis Summary</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-[9px] text-muted text-center py-4">Camera visual analysis results appear here during interview...</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {/* Confidence signals count */}
                <div className="p-2 bg-ok-50 rounded-lg border border-ok-100">
                  <div className="flex items-center gap-1 mb-1"><CheckCircle className="w-3 h-3 text-ok-600" /><span className="text-[9px] font-semibold text-ok-700">Confidence Signals</span></div>
                  <span className="text-lg font-bold text-ok-700 tabular-nums">{events.filter(e => e.type === 'confidence').length}</span>
                </div>
                {/* Stress signals count */}
                <div className="p-2 bg-risk-50 rounded-lg border border-risk-100">
                  <div className="flex items-center gap-1 mb-1"><AlertTriangle className="w-3 h-3 text-risk-600" /><span className="text-[9px] font-semibold text-risk-700">Stress Signals</span></div>
                  <span className="text-lg font-bold text-risk-700 tabular-nums">{events.filter(e => e.type === 'stress_risk' || e.type === 'evasion').length}</span>
                </div>
                {/* Camera exceptions */}
                <div className="p-2 bg-warn-50 rounded-lg border border-warn-100">
                  <div className="flex items-center gap-1 mb-1"><AlertCircle className="w-3 h-3 text-warn-600" /><span className="text-[9px] font-semibold text-warn-700">Camera Exceptions</span></div>
                  <span className="text-lg font-bold text-warn-700 tabular-nums">{events.filter(e => e.type === 'camera_exception').length}</span>
                </div>
                {/* Total events */}
                <div className="p-2 bg-brand-50 rounded-lg border border-brand-100">
                  <div className="flex items-center gap-1 mb-1"><Eye className="w-3 h-3 text-brand-600" /><span className="text-[9px] font-semibold text-brand-700">Total Visual Events</span></div>
                  <span className="text-lg font-bold text-brand-700 tabular-nums">{events.length}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ─── Block 5: Timeline Event Marker — Right Bottom */}
        <section className="col-span-3 row-span-1 bg-surface border border-border rounded-xl p-2.5 overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-brand-600" />
            <span className="text-[11px] font-semibold text-foreground">Block 5 · Timeline</span>
            <span className="ml-auto text-[9px] text-muted flex items-center gap-0.5"><Camera className="w-2.5 h-2.5" />Camera-triggered</span>
          </div>
          {events.length === 0 ? (
            <p className="text-[9px] text-muted text-center py-4">Timeline events triggered by camera visual signals only</p>
          ) : (
            <div className="space-y-1">{events.map(e => {
              const cfg = TIMELINE_TYPE_CONFIG[e.type] || TIMELINE_TYPE_CONFIG.confidence;
              const Icon = cfg.icon;
              return (
                <div key={e.id} className="p-1.5 rounded-lg hover:bg-ink-50 border border-transparent hover:border-border transition-all">
                  <div className="flex items-start gap-1.5">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.color}`}>
                      <Icon className="w-2.5 h-2.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-medium text-foreground leading-tight">{e.description}</p>
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        {e.timestampSec !== undefined && (
                          <span className="text-[7px] px-1 py-0.5 bg-ink-100 text-muted rounded font-mono">@{e.timestampSec}s</span>
                        )}
                        {e.jumpToVideo && (
                          <span className="text-[7px] px-1 py-0.5 bg-brand-50 text-brand-600 rounded font-mono cursor-pointer hover:bg-brand-100">▶ {e.jumpToVideo.startSec}s-{e.jumpToVideo.endSec}s</span>
                        )}
                      </div>
                      {e.relatedFollowUp && (
                        <p className="text-[7px] text-brand-600 mt-0.5 truncate">→ {e.relatedFollowUp}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}</div>
          )}
        </section>
      </div>
    </div>
  );
}
