import { useInterviewSessions } from '../../lib/api/hooks';
import { Bot, User, Info, Play, Pause, BarChart3, AlertTriangle, Shield, Zap, Mic, Video, FileText, Eye, Activity, Brain, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import type { InterviewSession } from '../../lib/api/types';

const followUpQuestions = [
  { role: 'ai' as const, content: '追问：您提到的分布式事务方案在高并发场景下的降级策略是什么？能否结合具体案例说明？', timestamp: '实时追问' },
  { role: 'candidate' as const, content: '在实际项目中，我们采用了Saga模式配合本地消息表。当TPS超过阈值时，系统会自动切换为最终一致性模式，通过补偿事务确保数据最终一致...', timestamp: '回答中' },
  { role: 'system' as const, content: '[AI评估] 回答深度: 8.5/10 · 技术准确性: 9/10 · 检测到STAR结构 · 证据链 #EV-2847', timestamp: '评估完成' },
];

const multiModalSignals = [
  { time: '02:15', type: 'voice', signal: '语速加快 (180wpm→220wpm)', confidence: 0.85, sentiment: 'neutral' },
  { time: '03:42', type: 'video', signal: '目光偏移 (左上方回忆区)', confidence: 0.72, sentiment: 'positive' },
  { time: '05:18', type: 'voice', signal: '犹豫停顿 2.3s', confidence: 0.91, sentiment: 'negative' },
  { time: '06:01', type: 'text', signal: 'STAR结构完整度 92%', confidence: 0.95, sentiment: 'positive' },
  { time: '07:30', type: 'video', signal: '微表情：自信 (嘴角上扬)', confidence: 0.68, sentiment: 'positive' },
  { time: '08:45', type: 'voice', signal: '语调平稳，逻辑清晰', confidence: 0.88, sentiment: 'positive' },
  { time: '10:12', type: 'text', signal: '关键词密度匹配 JD 87%', confidence: 0.93, sentiment: 'positive' },
];

const scoringMatrix = [
  { dimension: '技术深度', weight: 0.3, subItems: ['系统设计', '算法理解', '工程实践', '问题诊断'] },
  { dimension: '沟通表达', weight: 0.2, subItems: ['逻辑清晰', '表达流畅', '举例恰当', '互动意识'] },
  { dimension: '真实性验证', weight: 0.25, subItems: ['时间线一致', '细节可验证', '追问不矛盾', '情绪自然'] },
  { dimension: '文化匹配', weight: 0.15, subItems: ['价值观对齐', '团队协作', '抗压能力', '学习意愿'] },
  { dimension: '潜力评估', weight: 0.1, subItems: ['成长速度', '视野广度', '反思能力', '创新思维'] },
];

export default function Interview() {
  const { data: sessionsData, isLoading, error } = useInterviewSessions();
  const [selected, setSelected] = useState<InterviewSession | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [liveMessages, setLiveMessages] = useState<typeof followUpQuestions>([]);
  const [sseEvents, setSseEvents] = useState<string[]>([]);
  const [signalIdx, setSignalIdx] = useState(0);
  const [showMatrix, setShowMatrix] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const interviewSessions = sessionsData?.items || [];

  // Auto-select first session when data loads
  useEffect(() => {
    if (interviewSessions.length > 0 && !selected) {
      setSelected(interviewSessions[0]);
    }
  }, [interviewSessions, selected]);

  // SSE simulation
  useEffect(() => {
    if (!isLive) return;
    const events = [
      '🔵 候选人开始回答第3题...',
      '🟡 检测到犹豫停顿 (2.3s)，触发追问策略',
      '🟢 STAR结构识别成功，提取关键证据',
      '🔴 反面信号：项目时间线与简历不一致',
      '🟢 追问验证通过，置信度+5%',
      '🔵 多模态融合评分更新: 82.5 → 84.1',
      '🟢 面试结束，生成评估报告...',
    ];
    let idx = 0;
    const timer = setInterval(() => {
      if (idx < events.length) { setSseEvents(prev => [...prev, events[idx]]); idx++; }
    }, 2000);
    return () => clearInterval(timer);
  }, [isLive]);

  // Multi-modal signal simulation
  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => {
      setSignalIdx(prev => Math.min(prev + 1, multiModalSignals.length));
    }, 2500);
    return () => clearInterval(timer);
  }, [isLive]);

  // Live follow-up simulation
  useEffect(() => {
    if (!isLive) return;
    let idx = 0;
    const timer = setInterval(() => {
      if (idx < followUpQuestions.length) { setLiveMessages(prev => [...prev, followUpQuestions[idx]]); idx++; }
    }, 3000);
    return () => clearInterval(timer);
  }, [isLive]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [liveMessages, selected]);

  const toggleLive = () => {
    if (isLive) { setIsLive(false); } else { setIsLive(true); setLiveMessages([]); setSseEvents([]); setSignalIdx(0); }
  };

  const signalIcon = (type: string) => {
    if (type === 'voice') return <Mic className="w-3 h-3 text-purple-500" />;
    if (type === 'video') return <Video className="w-3 h-3 text-blue-500" />;
    return <FileText className="w-3 h-3 text-emerald-500" />;
  };

  if (isLoading) return <div className="p-8 flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /><span className="ml-3 text-muted">加载面试数据...</span></div>;
  if (error) return <div className="p-8 text-center text-red-500">加载失败：{(error as Error).message}</div>;
  if (!selected) return <div className="p-8 text-center text-muted">暂无面试数据</div>;

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-foreground">面试监控</h1><p className="text-sm text-muted mt-1">Interview Monitor · AI异步面试 · 多模态信号分析 · 实时追踪</p></div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowMatrix(!showMatrix)} className={`btn-secondary ${showMatrix ? 'ring-2 ring-brand-200' : ''}`}>
            <Brain className="w-4 h-4" />评分矩阵
          </button>
          <button onClick={toggleLive} className={`${isLive ? 'btn-primary' : 'btn-secondary'} gap-2`}>
            {isLive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isLive ? '暂停模拟' : '模拟实时面试'}
          </button>
        </div>
      </div>

      {/* Scoring Matrix Modal */}
      {showMatrix && (
        <div className="mb-6 glass-card p-5 animate-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">多维评分矩阵 · {selected.candidate}</h3>
            <span className="text-xs text-muted">权重总和 = 1.0</span>
          </div>
          <div className="grid grid-cols-5 gap-4">
            {scoringMatrix.map(dim => {
              const baseScore = selected.hardSkillScore || 75;
              const score = Math.round(baseScore + (Math.random() * 10 - 5));
              return (
                <div key={dim.dimension} className="p-3 bg-ink-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-foreground">{dim.dimension}</span>
                    <span className="text-[10px] text-muted">×{dim.weight}</span>
                  </div>
                  <p className="text-xl font-bold text-brand-600 mb-2">{score}</p>
                  <div className="h-1.5 bg-ink-200 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-brand-500 rounded-full" style={{ width: `${score}%` }} />
                  </div>
                  <div className="space-y-1">
                    {dim.subItems.map(sub => (
                      <div key={sub} className="flex items-center justify-between">
                        <span className="text-[10px] text-muted">{sub}</span>
                        <span className="text-[10px] font-medium text-foreground">{Math.round(score + (Math.random() * 8 - 4))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
        {/* Session List */}
        <div className="col-span-3 glass-card p-4 overflow-y-auto">
          <p className="section-title mb-3">面试列表</p>
          <div className="space-y-2">
            {interviewSessions.map(s => (
              <div key={s.id} onClick={() => setSelected(s)} className={`p-3 rounded-xl cursor-pointer transition-all ${selected.id === s.id ? 'bg-brand-50 border border-brand-200 shadow-sm' : 'hover:bg-ink-50 border border-transparent'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{s.candidate}</span>
                  <span className={`badge ${s.status === 'completed' ? 'badge-green' : 'badge-yellow'}`}>{s.status === 'completed' ? '已完成' : '进行中'}</span>
                </div>
                <p className="text-xs text-muted mt-1">{s.position}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-muted">{s.startTime}</span>
                  <span className="text-[10px] text-brand-500 font-medium">{s.dynamicQuestions}轮追问</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Panel */}
        <div className="col-span-5 glass-card p-6 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">{selected.candidate} · {selected.position}</h3>
              <p className="text-xs text-muted">{selected.startTime} · 时长 {selected.duration}min · {selected.dynamicQuestions}轮动态追问</p>
            </div>
            {selected.status === 'completed' && (
              <div className="flex items-center gap-4">
                <div className="text-center"><p className="text-lg font-bold text-brand-600">{selected.hardSkillScore}</p><p className="text-[10px] text-muted">硬技能</p></div>
                <div className="text-center"><p className="text-lg font-bold text-trust-600">{selected.softSkillScore}</p><p className="text-[10px] text-muted">软技能</p></div>
                <div className="text-center"><p className="text-lg font-bold text-ok-600">{selected.authenticityScore}</p><p className="text-[10px] text-muted">真实性</p></div>
              </div>
            )}
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-2">
            {selected.transcript.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'candidate' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'ai' ? 'bg-brand-100 text-brand-600' : msg.role === 'candidate' ? 'bg-ink-200 text-muted' : 'bg-warn-100 text-warn-600'}`}>
                  {msg.role === 'ai' ? <Bot className="w-3.5 h-3.5" /> : msg.role === 'candidate' ? <User className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
                </div>
                <div className={`max-w-[75%] p-3 rounded-xl ${msg.role === 'ai' ? 'bg-brand-50 border border-brand-100' : msg.role === 'candidate' ? 'bg-ink-50 border border-border' : 'bg-warn-50 border border-warn-100'}`}>
                  <p className="text-sm text-foreground leading-relaxed">{msg.content}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-muted">{msg.timestamp}</span>
                    {msg.evidenceLink && <span className="text-[10px] text-brand-500 font-mono">#{msg.evidenceLink}</span>}
                  </div>
                </div>
              </div>
            ))}
            {liveMessages.map((msg, i) => (
              <div key={`live-${i}`} className={`flex gap-3 ${msg.role === 'candidate' ? 'flex-row-reverse' : ''} animate-in`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'ai' ? 'bg-brand-100 text-brand-600' : msg.role === 'candidate' ? 'bg-ink-200 text-muted' : 'bg-warn-100 text-warn-600'}`}>
                  {msg.role === 'ai' ? <Bot className="w-3.5 h-3.5" /> : msg.role === 'candidate' ? <User className="w-3.5 h-3.5" /> : <BarChart3 className="w-3.5 h-3.5" />}
                </div>
                <div className={`max-w-[75%] p-3 rounded-xl ${msg.role === 'ai' ? 'bg-brand-50 border border-brand-100' : msg.role === 'candidate' ? 'bg-ink-50 border border-border' : 'bg-ok-50 border border-ok-100'}`}>
                  <p className="text-sm text-foreground leading-relaxed">{msg.content}</p>
                  <span className="text-[10px] text-brand-500 mt-1 inline-block">{msg.timestamp}</span>
                </div>
              </div>
            ))}
            {isLive && <div className="flex items-center gap-2 p-2"><div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" /><span className="text-xs text-muted">AI正在分析回答...</span></div>}
          </div>
        </div>

        {/* Right Panel - Multi-modal + SSE */}
        <div className="col-span-4 flex flex-col gap-4 min-h-0">
          {/* Multi-modal Signals */}
          <div className="glass-card p-4 flex-1 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-brand-500" />
              <p className="section-title">多模态信号检测</p>
            </div>
            <div className="flex items-center gap-3 mb-3 p-2 bg-ink-50 rounded-lg">
              <div className="flex items-center gap-1.5"><Mic className="w-3 h-3 text-purple-500" /><span className="text-[10px] text-muted">语音</span></div>
              <div className="flex items-center gap-1.5"><Video className="w-3 h-3 text-blue-500" /><span className="text-[10px] text-muted">视觉</span></div>
              <div className="flex items-center gap-1.5"><FileText className="w-3 h-3 text-emerald-500" /><span className="text-[10px] text-muted">文本</span></div>
            </div>
            <div className="space-y-2">
              {multiModalSignals.slice(0, isLive ? signalIdx : multiModalSignals.length).map((sig, i) => (
                <div key={i} className={`p-2.5 rounded-lg border transition-all animate-in ${sig.sentiment === 'positive' ? 'bg-emerald-50/50 border-emerald-100' : sig.sentiment === 'negative' ? 'bg-red-50/50 border-red-100' : 'bg-ink-50 border-border'}`}>
                  <div className="flex items-center gap-2">
                    {signalIcon(sig.type)}
                    <span className="text-[10px] text-muted font-mono">{sig.time}</span>
                    <div className="flex-1" />
                    <span className={`text-[10px] font-medium ${sig.confidence >= 0.9 ? 'text-emerald-600' : sig.confidence >= 0.75 ? 'text-brand-600' : 'text-amber-600'}`}>{Math.round(sig.confidence * 100)}%</span>
                  </div>
                  <p className="text-xs text-foreground mt-1 ml-5">{sig.signal}</p>
                </div>
              ))}
              {isLive && signalIdx < multiModalSignals.length && (
                <div className="flex items-center gap-2 p-2"><div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" /><span className="text-[10px] text-muted">检测中...</span></div>
              )}
            </div>
          </div>

          {/* SSE Events */}
          <div className="glass-card p-4 h-48 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="section-title">SSE 实时事件流</p>
            </div>
            <div className="space-y-1.5">
              {sseEvents.length === 0 && <p className="text-xs text-muted py-4 text-center">点击"模拟实时面试"开始</p>}
              {sseEvents.map((ev, i) => (
                <div key={i} className="p-2 rounded-lg bg-ink-50 text-xs text-muted animate-in">{ev}</div>
              ))}
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="glass-card p-4">
            <p className="section-title mb-3">信任与合规</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-trust-500" /><span className="text-xs text-muted">面试过程CA签名存证</span></div>
              <div className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-brand-500" /><span className="text-xs text-muted">AI追问策略自动触发</span></div>
              <div className="flex items-center gap-2"><Eye className="w-3.5 h-3.5 text-purple-500" /><span className="text-xs text-muted">多模态信号融合分析</span></div>
              <div className="flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 text-warn-500" /><span className="text-xs text-muted">异常行为实时检测</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
