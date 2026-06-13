import { useDecisionProposals, useOrgHealthMetrics, useSSEEvents } from '../../lib/api/hooks';
import TrustChainVisualizer from '../../components/TrustChainVisualizer';
import CABadge from '../../components/CABadge';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, ArrowRight, Bell, Zap, Fingerprint, Keyboard, X, ToggleLeft, ToggleRight, FileText, BarChart3, Loader2 } from 'lucide-react';
import { useApp } from '../../App';
import { useState, useEffect } from 'react';

const featureFlags = [
  { id: 'ff-1', name: 'AI自主面试', key: 'ai_autonomous_interview', enabled: true, scope: '全量', version: 'v2.3.1' },
  { id: 'ff-2', name: '背书NFT铸造', key: 'endorsement_nft_mint', enabled: false, scope: '灰度10%', version: 'v2.4.0-beta' },
  { id: 'ff-3', name: '继任推演引擎', key: 'succession_simulation', enabled: true, scope: '国企端', version: 'v2.3.1' },
  { id: 'ff-4', name: '多模态面试信号', key: 'multimodal_interview', enabled: true, scope: '全量', version: 'v2.3.1' },
  { id: 'ff-5', name: 'ScopedToken授权', key: 'scoped_token_auth', enabled: true, scope: '国企端', version: 'v2.3.0' },
  { id: 'ff-6', name: '智能薪酬对标', key: 'smart_compensation', enabled: false, scope: '灰度30%', version: 'v2.4.0-beta' },
];

export default function CommandCenter() {
  const { setShowLineage } = useApp();
  const { data: proposalsData, isLoading: proposalsLoading, error: proposalsError } = useDecisionProposals({ status: 'pending' });
  const { data: metricsData, isLoading: metricsLoading, error: metricsError } = useOrgHealthMetrics();
  const { data: eventsData } = useSSEEvents();

  const metrics = metricsData ? Object.values(metricsData) : [];
  const decisionProposals = proposalsData?.items || [];
  const pending = decisionProposals.filter(d => d.status === 'pending');
  const sseEvents = eventsData?.items || [];

  const [liveEvents, setLiveEvents] = useState<typeof sseEvents>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'decisions' | 'flags' | 'reports'>('decisions');
  const [flags, setFlags] = useState(featureFlags);

  // Initialize live events when SSE data loads
  useEffect(() => {
    if (sseEvents.length > 0 && liveEvents.length === 0) {
      setLiveEvents(sseEvents.slice(0, 3));
    }
  }, [sseEvents]);

  // SSE simulation - new events appear over time
  useEffect(() => {
    if (sseEvents.length === 0 || liveEvents.length >= sseEvents.length) return;
    const timer = setTimeout(() => {
      setLiveEvents(prev => [...prev, sseEvents[prev.length]]);
    }, 4000);
    return () => clearTimeout(timer);
  }, [liveEvents.length, sseEvents]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'l') { e.preventDefault(); setShowLineage(true); }
      if (e.key === '?') setShowShortcuts(s => !s);
      if (e.ctrlKey && e.key === 'e') { e.preventDefault(); handleExportReport(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setShowLineage]);

  const handleApprove = (id: string) => setApprovedIds(prev => new Set([...prev, id]));
  const toggleFlag = (id: string) => setFlags(prev => prev.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f));

  const handleExportReport = () => {
    const report = `蓉才通™ 决策总控台日报\n${'='.repeat(40)}\n生成时间: ${new Date().toLocaleString()}\n\n组织健康指标:\n${metrics.map(m => `  ${m.label}: ${m.value} (${m.trend})`).join('\n')}\n\n待决策队列: ${pending.length}项\n${pending.map(d => `  [${d.type}] ${d.candidate} → ${d.position} (置信度${d.confidence}%)`).join('\n')}\n\nFeature Flags状态:\n${flags.map(f => `  ${f.enabled ? '✓' : '✗'} ${f.name} [${f.scope}]`).join('\n')}`;
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `command-center-report-${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const loadError = proposalsError || metricsError;
  if (proposalsLoading || metricsLoading) return <div className="p-8 flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /><span className="ml-3 text-slate-500">加载决策数据...</span></div>;
  if (loadError) return <div className="p-8 text-center text-red-500">加载失败：{(loadError as Error).message}</div>;

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">决策总控台</h1>
          <p className="text-sm text-slate-500 mt-1">Command Center · 实时决策态势感知 · Feature Flags管控</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowShortcuts(true)} className="btn-ghost text-xs"><Keyboard className="w-4 h-4" />快捷键</button>
          <button onClick={handleExportReport} className="btn-ghost text-xs"><FileText className="w-4 h-4" />导出报告</button>
          <button className="btn-secondary relative"><Bell className="w-4 h-4" />通知 <span className="absolute -top-1 -right-1 w-4 h-4 bg-error-500 text-white text-[9px] rounded-full flex items-center justify-center">3</span></button>
          <button onClick={() => setShowLineage(true)} className="btn-secondary"><Fingerprint className="w-4 h-4" />决策血统 <span className="text-[10px] text-slate-400 ml-1">Ctrl+L</span></button>
          <button className="btn-primary"><Zap className="w-4 h-4" />快速决策</button>
        </div>
      </div>

      {/* 信任传导链路 */}
      <div className="mb-6">
        <TrustChainVisualizer compact />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {metrics.map((m, i) => (
          <div key={i} className="stat-card">
            <p className="text-xs text-slate-500 mb-1">{m.label}</p>
            <p className="text-2xl font-bold text-slate-900">{m.value}</p>
            <div className="flex items-center gap-1 mt-1">
              {String(m.trend).startsWith('+') ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-red-500" />}
              <span className={`text-xs font-medium ${String(m.trend).startsWith('+') ? 'text-emerald-600' : 'text-red-600'}`}>{m.trend}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200">
        {[
          { id: 'decisions' as const, label: '待决策队列', icon: CheckCircle2, count: pending.filter(d => !approvedIds.has(d.id)).length },
          { id: 'flags' as const, label: 'Feature Flags', icon: ToggleLeft, count: flags.filter(f => f.enabled).length },
          { id: 'reports' as const, label: '决策报表', icon: BarChart3 },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab.id ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <tab.icon className="w-4 h-4" />{tab.label}
            {tab.count !== undefined && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'}`}>{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Tab Content + Event Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-6">
          {activeTab === 'decisions' && (
            <>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-slate-800">待决策队列</h2>
                <div className="flex items-center gap-2">
                  <span className="badge badge-blue">{pending.filter(d => !approvedIds.has(d.id)).length} 待处理</span>
                  <button onClick={() => pending.forEach(d => handleApprove(d.id))} className="text-xs text-primary-600 hover:underline font-medium">批量审批</button>
                </div>
              </div>
              <div className="space-y-3">
                {pending.map(d => (
                  <div key={d.id} className={`flex items-center gap-4 p-4 rounded-xl transition-all group ${approvedIds.has(d.id) ? 'bg-success-50/50 border border-success-100' : 'bg-slate-50/80 hover:bg-white hover:shadow-card border border-transparent'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${d.riskLevel === 'high' ? 'bg-red-50 text-red-500' : d.riskLevel === 'medium' ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'}`}>
                      {d.riskLevel === 'high' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setShowLineage(true)}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{d.candidate}</span>
                        <span className="badge badge-blue">{d.type}</span>
                        {approvedIds.has(d.id) && <span className="badge badge-green">已审批</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{d.position} · 置信度 {d.confidence}% · {d.evidenceCount}条证据 · <span className="font-mono">{d.modelVersion}</span></p>
                    </div>
                    <div className="text-right mr-2">
                      <p className="text-xs text-slate-400">{d.timestamp.split(' ')[1]}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{d.lineageHash}</p>
                    </div>
                    {!approvedIds.has(d.id) && (
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleApprove(d.id)} className="text-xs px-3 py-1.5 bg-success-500 text-white rounded-lg hover:bg-success-600">通过</button>
                        <button className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">驳回</button>
                      </div>
                    )}
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary-500 transition-colors cursor-pointer" onClick={() => setShowLineage(true)} />
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'flags' && (
            <>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-slate-800">Feature Flags 管控面板</h2>
                <span className="text-xs text-slate-400">{flags.filter(f => f.enabled).length}/{flags.length} 已启用</span>
              </div>
              <div className="space-y-3">
                {flags.map(f => (
                  <div key={f.id} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50/80 hover:bg-white hover:shadow-card border border-transparent transition-all">
                    <button onClick={() => toggleFlag(f.id)} className="flex-shrink-0">
                      {f.enabled ? <ToggleRight className="w-8 h-8 text-primary-500" /> : <ToggleLeft className="w-8 h-8 text-slate-300" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{f.name}</span>
                        <span className={`badge ${f.enabled ? 'badge-green' : 'badge-gray'}`}>{f.enabled ? '启用' : '禁用'}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">{f.key} · 范围: {f.scope} · {f.version}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200">配置</button>
                      <button className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200">日志</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'reports' && (
            <>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-slate-800">决策报表</h2>
                <button onClick={handleExportReport} className="btn-secondary text-xs"><FileText className="w-3.5 h-3.5" />导出</button>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-primary-50/50 border border-primary-100">
                  <p className="text-xs text-primary-600 font-medium">本周决策总量</p>
                  <p className="text-3xl font-bold text-primary-700 mt-1">47</p>
                  <p className="text-xs text-primary-500 mt-1">较上周 +12%</p>
                </div>
                <div className="p-4 rounded-xl bg-success-50/50 border border-success-100">
                  <p className="text-xs text-success-600 font-medium">AI自主率</p>
                  <p className="text-3xl font-bold text-success-700 mt-1">72%</p>
                  <p className="text-xs text-success-500 mt-1">目标 80%</p>
                </div>
                <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100">
                  <p className="text-xs text-amber-600 font-medium">平均决策耗时</p>
                  <p className="text-3xl font-bold text-amber-700 mt-1">2.3h</p>
                  <p className="text-xs text-amber-500 mt-1">较上周 -18%</p>
                </div>
                <div className="p-4 rounded-xl bg-violet-50/50 border border-violet-100">
                  <p className="text-xs text-violet-600 font-medium">U盾签名覆盖</p>
                  <p className="text-3xl font-bold text-violet-700 mt-1">89%</p>
                  <p className="text-xs text-violet-500 mt-1">合规目标 100%</p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs font-semibold text-slate-600 mb-3">决策类型分布</p>
                <div className="space-y-2">
                  {[{ type: 'Hire', count: 23, pct: 49 }, { type: 'Promote', count: 12, pct: 26 }, { type: 'Transfer', count: 7, pct: 15 }, { type: 'Retain', count: 3, pct: 6 }, { type: 'Replace', count: 2, pct: 4 }].map(item => (
                    <div key={item.type} className="flex items-center gap-3">
                      <span className="text-xs text-slate-600 w-16">{item.type}</span>
                      <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-400 rounded-full transition-all" style={{ width: `${item.pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 w-12 text-right">{item.count}项</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* SSE Event Stream */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-slate-800">实时事件流</h2>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /><span className="text-[10px] text-slate-400">SSE Live</span></div>
          </div>
          <div className="space-y-3">
            {liveEvents.map((ev, i) => (
              <div key={ev.id} className={`flex gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer ${i === liveEvents.length - 1 ? 'animate-in' : ''}`}>
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${ev.priority === 'high' ? 'bg-red-500' : ev.priority === 'medium' ? 'bg-amber-500' : 'bg-slate-300'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">{ev.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{ev.description}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{ev.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 text-center">基于Server-Sent Events协议实时推送</p>
            <p className="text-[10px] text-slate-400 text-center mt-0.5">延迟 &lt; 200ms · 连接状态: 活跃</p>
          </div>
        </div>
      </div>

      {/* Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white rounded-2xl shadow-elevated p-6 w-96" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800">键盘快捷键</h3>
              <button onClick={() => setShowShortcuts(false)} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              {[
                ['Ctrl + L', '打开决策血统追溯'],
                ['Ctrl + E', '导出当前页面报告'],
                ['Ctrl + K', '全局搜索'],
                ['?', '显示/隐藏快捷键面板'],
                ['Esc', '关闭弹窗'],
                ['Tab', '切换面板标签'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                  <span className="text-xs text-slate-600">{desc}</span>
                  <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-mono text-slate-700 shadow-sm">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
