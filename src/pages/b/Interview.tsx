/**
 * 蓉才通™ ATOS — AI Interview OS: Video Workspace
 * 
 * 对标: HireVue × Karat × Final Round AI
 * 
 * 真实能力:
 * - WebSocket连接后端Interview Orchestrator
 * - MediaRecorder录音 → 分片上传 → Whisper ASR
 * - Agent事件实时渲染（STAR/Competency/Followup/Score）
 * - Session状态机（idle→connecting→in_progress→completed）
 * - Demo模式：无后端时自动模拟完整Agent Pipeline
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Video, VideoOff, Play, Square, Clock,
  Brain, Target, MessageSquare, TrendingUp, AlertTriangle,
  CheckCircle, XCircle, ChevronRight, BarChart3, Zap,
  User, Bot, Wifi, WifiOff, Volume2, Shield, Eye
} from 'lucide-react';
import { useInterviewSessions } from '../../lib/api/hooks';
import { LoadingView, ErrorView } from '../../components/StateViews';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TranscriptEntry {
  id: string;
  speaker: 'candidate' | 'interviewer' | 'system';
  text: string;
  timestamp: number;
  confidence: number;
  starTag?: 'situation' | 'task' | 'action' | 'result';
}

interface CompetencyScore {
  dimension: string;
  score: number;
  signals: string[];
  trend: 'up' | 'down' | 'stable';
}

interface TimelineEvent {
  id: string;
  type: 'star_detected' | 'competency_signal' | 'followup_triggered' | 'risk_signal' | 'score_update';
  timestamp: number;
  data: Record<string, unknown>;
  label: string;
}

interface SessionState {
  status: 'idle' | 'connecting' | 'in_progress' | 'paused' | 'completed';
  sessionId: string | null;
  currentQuestionIdx: number;
  totalQuestions: number;
  elapsedSeconds: number;
}

// ─── WebSocket Hook ──────────────────────────────────────────────────────────

function useInterviewWebSocket(sessionId: string | null) {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [competencies, setCompetencies] = useState<CompetencyScore[]>(initCompetencies());
  const [followups, setFollowups] = useState<string[]>([]);
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
      case 'interview:transcript':
        setTranscripts(prev => [...prev, { id, speaker: (payload.data.speaker as TranscriptEntry['speaker']) || 'candidate', text: (payload.data.text as string) || '', timestamp: ts, confidence: (payload.data.confidence as number) || 0.95, starTag: payload.data.starTag as TranscriptEntry['starTag'] }]);
        break;
      case 'interview:star_detected':
        setEvents(prev => [...prev, { id, type: 'star_detected', timestamp: ts, data: payload.data, label: `STAR: ${((payload.data.component as string) || '').toUpperCase()}` }]);
        break;
      case 'interview:competency_signal': {
        const dim = payload.data.dimension as string;
        const score = payload.data.score as number;
        const signal = payload.data.signal as string;
        setCompetencies(prev => prev.map(c => c.dimension === dim ? { ...c, score: Math.round(score), signals: [...c.signals, signal].slice(-3), trend: score > c.score ? 'up' : score < c.score ? 'down' : 'stable' } : c));
        setEvents(prev => [...prev, { id, type: 'competency_signal', timestamp: ts, data: payload.data, label: `${dim}: ${Math.round(score)}pts` }]);
        break;
      }
      case 'interview:followup':
        setFollowups(prev => [...prev, payload.data.question as string]);
        setEvents(prev => [...prev, { id, type: 'followup_triggered', timestamp: ts, data: payload.data, label: 'Follow-up generated' }]);
        break;
      case 'interview:score_update':
        setOverallScore(Math.round(payload.data.overallScore as number));
        setEvents(prev => [...prev, { id, type: 'score_update', timestamp: ts, data: payload.data, label: `Score: ${Math.round(payload.data.overallScore as number)}` }]);
        break;
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
      recorder.start(5000); // 5s chunks
      setRecording(true);
    } catch (err) { console.error('Mic access denied:', err); }
  }, [onChunk]);

  const stop = useCallback(() => {
    if (recorderRef.current) { recorderRef.current.stop(); recorderRef.current.stream.getTracks().forEach(t => t.stop()); recorderRef.current = null; }
    setRecording(false);
  }, []);

  return { recording, start, stop };
}

// ─── Demo Simulation ─────────────────────────────────────────────────────────

function useDemoSimulation(active: boolean, status: SessionState['status']) {
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [competencies, setCompetencies] = useState<CompetencyScore[]>(initCompetencies());
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [followups, setFollowups] = useState<string[]>([]);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!active || status !== 'in_progress') return;
    const script: Array<{ delay: number; fn: () => void }> = [
      { delay: 2000, fn: () => setTranscripts(p => [...p, mkT('interviewer', '请描述一个你主导的技术架构决策，以及它带来的业务影响。')]) },
      { delay: 5000, fn: () => { setTranscripts(p => [...p, mkT('candidate', '在上一家公司，我们面临一个核心问题：系统每天处理200万订单，但延迟从50ms飙升到了800ms...', 0.94, 'situation')]); setEvents(p => [...p, mkE('star_detected', 'STAR: SITUATION')]); } },
      { delay: 9000, fn: () => { setTranscripts(p => [...p, mkT('candidate', '我的任务是在不停机的情况下，将整个订单系统从单体架构迁移到事件驱动的微服务架构，同时保证99.99%的可用性。', 0.96, 'task')]); setEvents(p => [...p, mkE('star_detected', 'STAR: TASK')]); setCompetencies(p => p.map(c => c.dimension === 'Leadership' ? { ...c, score: 72, trend: 'up', signals: ['主导架构决策'] } : c)); } },
      { delay: 14000, fn: () => { setTranscripts(p => [...p, mkT('candidate', '我首先做了3周的流量分析，识别出热点路径。然后设计了双写+影子流量方案，用Feature Flag逐步切流。关键是我说服了CTO接受"慢迁移"策略。', 0.92, 'action')]); setEvents(p => [...p, mkE('star_detected', 'STAR: ACTION'), mkE('competency_signal', 'Execution: 81pts')]); setCompetencies(p => p.map(c => { if (c.dimension === 'Execution') return { ...c, score: 81, trend: 'up', signals: ['系统性方法论', '风险控制'] }; if (c.dimension === 'Communication') return { ...c, score: 76, trend: 'up', signals: ['说服CTO'] }; return c; })); setScore(74); } },
      { delay: 18000, fn: () => { setFollowups(p => [...p, '你提到"慢迁移"策略，当时CTO的主要顾虑是什么？你是如何量化风险来说服他的？']); setEvents(p => [...p, mkE('followup_triggered', 'Follow-up: 说服策略深挖')]); } },
      { delay: 22000, fn: () => { setTranscripts(p => [...p, mkT('candidate', '最终结果：延迟从800ms降到35ms，系统吞吐量提升4倍。这个架构支撑了后续3年的业务增长，从200万单/天到800万单/天。', 0.97, 'result')]); setEvents(p => [...p, mkE('star_detected', 'STAR: RESULT'), mkE('score_update', 'Score: 84')]); setCompetencies(p => p.map(c => { if (c.dimension === 'Ownership') return { ...c, score: 85, trend: 'up', signals: ['长期视角', '业务量化'] }; if (c.dimension === 'Execution') return { ...c, score: 88, trend: 'up', signals: [...c.signals, '4x吞吐'] }; if (c.dimension === 'Stress Resistance') return { ...c, score: 78, trend: 'up', signals: ['高压决策'] }; if (c.dimension === 'Leadership') return { ...c, score: 82, trend: 'up', signals: [...c.signals, '跨部门协调'] }; return c; })); setScore(84); } },
    ];
    const timers = script.map(({ delay, fn }) => setTimeout(fn, delay));
    return () => timers.forEach(clearTimeout);
  }, [active, status]);

  return { transcripts, competencies, events, followups, score };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initCompetencies(): CompetencyScore[] {
  return [
    { dimension: 'Leadership', score: 0, signals: [], trend: 'stable' },
    { dimension: 'Communication', score: 0, signals: [], trend: 'stable' },
    { dimension: 'Execution', score: 0, signals: [], trend: 'stable' },
    { dimension: 'Ownership', score: 0, signals: [], trend: 'stable' },
    { dimension: 'Stress Resistance', score: 0, signals: [], trend: 'stable' },
  ];
}

function mkT(speaker: TranscriptEntry['speaker'], text: string, confidence = 1.0, starTag?: TranscriptEntry['starTag']): TranscriptEntry {
  return { id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, speaker, text, timestamp: Date.now(), confidence, starTag };
}

function mkE(type: TimelineEvent['type'], label: string): TimelineEvent {
  return { id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, type, timestamp: Date.now(), data: {}, label };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Interview() {
  const { data: sessionsData, isLoading, error } = useInterviewSessions();
  const [session, setSession] = useState<SessionState>({ status: 'idle', sessionId: null, currentQuestionIdx: 0, totalQuestions: 5, elapsedSeconds: 0 });
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
    setSession(p => ({ ...p, status: 'in_progress', elapsedSeconds: 0 }));
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
    '请描述一个你主导的技术架构决策，以及它带来的业务影响。',
    '你如何处理团队中的技术分歧？请举一个具体例子。',
    '描述一次你在高压环境下做出关键决策的经历。',
    '你如何评估和管理技术债务？',
    '请分享一个你推动组织级变革的案例。',
  ];

  if (isLoading) return <LoadingView />;
  if (error) return <ErrorView message={(error as Error).message} />;

  return (
    <div className="h-full flex flex-col gap-3 p-4">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-foreground">AI Interview Workspace</h1>
          <span className="px-2 py-0.5 text-[10px] font-medium bg-trust-50 text-trust-700 rounded-full border border-trust-200">CA Signed</span>
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

      {/* ─── Main Grid ──────────────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-12 grid-rows-2 gap-3 min-h-0">

        {/* Question Panel — Left Top */}
        <section className="col-span-3 row-span-1 bg-surface border border-border rounded-xl p-3 overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-3.5 h-3.5 text-brand-600" />
            <span className="text-xs font-semibold text-foreground">Questions</span>
            <span className="ml-auto text-[10px] text-muted tabular-nums">{session.currentQuestionIdx + 1}/{questions.length}</span>
          </div>
          <div className="space-y-1.5">
            {questions.map((q, i) => (
              <div key={i} onClick={() => setSession(p => ({ ...p, currentQuestionIdx: i }))} className={`p-2.5 rounded-lg text-[11px] leading-relaxed cursor-pointer transition-all ${i === session.currentQuestionIdx ? 'bg-brand-50 border border-brand-200 text-foreground font-medium' : i < session.currentQuestionIdx ? 'bg-ok-50 border border-ok-100 text-muted line-through' : 'bg-ink-50 text-muted hover:bg-ink-100'}`}>
                <span className="font-mono text-[9px] mr-1">Q{i + 1}</span>{q}
              </div>
            ))}
          </div>
        </section>

        {/* Video Area — Center Top */}
        <section className="col-span-6 row-span-1 bg-ink-900 rounded-xl overflow-hidden relative">
          <div className="absolute inset-0 flex items-center justify-center">
            {videoEnabled ? (
              <div className="w-full h-full bg-gradient-to-br from-ink-800 to-ink-900 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-ink-700 flex items-center justify-center mx-auto mb-2"><User className="w-10 h-10 text-ink-400" /></div>
                  <p className="text-ink-400 text-xs">Candidate Camera</p>
                  <p className="text-ink-500 text-[10px] mt-0.5">{session.status === 'in_progress' ? 'Recording...' : 'Waiting'}</p>
                </div>
              </div>
            ) : <p className="text-ink-500 text-xs">Camera Off</p>}
          </div>
          {/* AI Avatar PiP */}
          <div className="absolute bottom-3 right-3 w-28 h-28 rounded-xl bg-ink-800 border border-ink-600 flex items-center justify-center shadow-lg">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-brand-600/20 flex items-center justify-center mx-auto mb-1"><Brain className="w-5 h-5 text-brand-400" /></div>
              <p className="text-[9px] text-ink-400">AI Interviewer</p>
              {session.status === 'in_progress' && <div className="flex items-center justify-center gap-0.5 mt-0.5"><Volume2 className="w-2.5 h-2.5 text-brand-400 animate-pulse" /><span className="text-[8px] text-brand-400">Active</span></div>}
            </div>
          </div>
          {/* Controls */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
            <button onClick={() => setVideoEnabled(!videoEnabled)} className={`p-1.5 rounded-full ${videoEnabled ? 'bg-white/10 text-white' : 'bg-risk-600 text-white'}`}>{videoEnabled ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}</button>
            <button onClick={() => recorder.recording ? recorder.stop() : recorder.start()} className={`p-1.5 rounded-full ${recorder.recording ? 'bg-risk-600 text-white animate-pulse' : 'bg-white/10 text-white'}`}>{recorder.recording ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}</button>
          </div>
          {session.status === 'in_progress' && <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-0.5 bg-risk-600/90 rounded-full"><div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /><span className="text-[9px] text-white font-medium">REC</span></div>}
        </section>

        {/* Live Score — Right Top */}
        <section className="col-span-3 row-span-1 bg-surface border border-border rounded-xl p-3 overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-3.5 h-3.5 text-brand-600" />
            <span className="text-xs font-semibold text-foreground">Competency</span>
          </div>
          <div className="space-y-2.5">
            {competencies.map(c => (
              <div key={c.dimension}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] font-medium text-foreground">{c.dimension}</span>
                  <div className="flex items-center gap-1">
                    {c.trend === 'up' && <TrendingUp className="w-2.5 h-2.5 text-ok-500" />}
                    {c.trend === 'down' && <AlertTriangle className="w-2.5 h-2.5 text-risk-500" />}
                    <span className="text-[11px] font-bold text-foreground tabular-nums">{c.score || '—'}</span>
                  </div>
                </div>
                <div className="h-1 bg-ink-100 rounded-full overflow-hidden"><div className="h-full bg-brand-500 rounded-full transition-all duration-700" style={{ width: `${c.score}%` }} /></div>
                {c.signals.length > 0 && <div className="flex flex-wrap gap-0.5 mt-0.5">{c.signals.map((s, i) => <span key={i} className="text-[8px] px-1 py-0.5 bg-brand-50 text-brand-600 rounded">{s}</span>)}</div>}
              </div>
            ))}
          </div>
          {overallScore > 0 && <div className="mt-3 pt-2 border-t border-border flex items-center justify-between"><span className="text-[11px] font-semibold text-foreground">Overall</span><span className="text-base font-bold text-brand-700 tabular-nums">{overallScore}</span></div>}
          {/* Trust */}
          <div className="mt-3 pt-2 border-t border-border space-y-1">
            <div className="flex items-center gap-1.5"><Shield className="w-3 h-3 text-trust-500" /><span className="text-[9px] text-muted">CA签名存证</span></div>
            <div className="flex items-center gap-1.5"><Eye className="w-3 h-3 text-brand-500" /><span className="text-[9px] text-muted">多模态融合</span></div>
          </div>
        </section>

        {/* Follow-up Queue — Left Bottom */}
        <section className="col-span-3 row-span-1 bg-surface border border-border rounded-xl p-3 overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-3.5 h-3.5 text-warn-500" />
            <span className="text-xs font-semibold text-foreground">Follow-ups</span>
            <span className="ml-auto text-[10px] text-muted tabular-nums">{followups.length}</span>
          </div>
          {followups.length === 0 ? (
            <p className="text-[10px] text-muted text-center py-6">Agent will generate follow-up questions based on responses</p>
          ) : (
            <div className="space-y-1.5">{followups.map((q, i) => (
              <div key={i} className="p-2 bg-warn-50 border border-warn-100 rounded-lg flex items-start gap-1.5">
                <ChevronRight className="w-3 h-3 text-warn-500 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-foreground leading-relaxed">{q}</p>
              </div>
            ))}</div>
          )}
        </section>

        {/* Transcript — Center Bottom */}
        <section className="col-span-6 row-span-1 bg-surface border border-border rounded-xl p-3 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-3.5 h-3.5 text-brand-600" />
            <span className="text-xs font-semibold text-foreground">Live Transcript</span>
            <span className="ml-auto text-[9px] text-muted">Whisper ASR → Real-time</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {transcripts.length === 0 ? (
              <p className="text-[10px] text-muted text-center py-10">Transcript appears here once interview starts...</p>
            ) : transcripts.map(t => (
              <div key={t.id} className={`flex gap-2 ${t.speaker === 'candidate' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${t.speaker === 'interviewer' ? 'bg-brand-100 text-brand-600' : 'bg-ink-200 text-muted'}`}>
                  {t.speaker === 'interviewer' ? <Bot className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
                </div>
                <div className={`max-w-[80%] p-2 rounded-lg ${t.speaker === 'interviewer' ? 'bg-brand-50 border border-brand-100' : 'bg-ink-50 border border-border'}`}>
                  <p className="text-[11px] text-foreground leading-relaxed">{t.text}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[8px] text-muted tabular-nums">{new Date(t.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    <span className="text-[8px] text-muted">conf:{(t.confidence * 100).toFixed(0)}%</span>
                    {t.starTag && <span className={`text-[8px] px-1 py-0.5 rounded font-medium ${t.starTag === 'situation' ? 'bg-blue-100 text-blue-700' : t.starTag === 'task' ? 'bg-purple-100 text-purple-700' : t.starTag === 'action' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{t.starTag.toUpperCase()}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Timeline — Right Bottom */}
        <section className="col-span-3 row-span-1 bg-surface border border-border rounded-xl p-3 overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-brand-600" />
            <span className="text-xs font-semibold text-foreground">Timeline</span>
            <span className="ml-auto text-[10px] text-muted tabular-nums">{events.length}</span>
          </div>
          {events.length === 0 ? (
            <p className="text-[10px] text-muted text-center py-6">Events appear during interview</p>
          ) : (
            <div className="space-y-1">{events.map(e => (
              <div key={e.id} className="flex items-start gap-1.5 p-1.5 rounded hover:bg-ink-50">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${e.type === 'star_detected' ? 'bg-blue-100 text-blue-600' : e.type === 'competency_signal' ? 'bg-brand-100 text-brand-600' : e.type === 'followup_triggered' ? 'bg-warn-100 text-warn-600' : e.type === 'risk_signal' ? 'bg-risk-100 text-risk-600' : 'bg-ok-100 text-ok-600'}`}>
                  {e.type === 'star_detected' && <CheckCircle className="w-2.5 h-2.5" />}
                  {e.type === 'competency_signal' && <Target className="w-2.5 h-2.5" />}
                  {e.type === 'followup_triggered' && <Zap className="w-2.5 h-2.5" />}
                  {e.type === 'risk_signal' && <XCircle className="w-2.5 h-2.5" />}
                  {e.type === 'score_update' && <BarChart3 className="w-2.5 h-2.5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-foreground truncate">{e.label}</p>
                  <p className="text-[8px] text-muted tabular-nums">{new Date(e.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                </div>
              </div>
            ))}</div>
          )}
        </section>
      </div>
    </div>
  );
}
