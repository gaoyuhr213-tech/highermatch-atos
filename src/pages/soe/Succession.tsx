import { useSuccessionPlans } from '../../lib/api/hooks';
import { Users, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, TrendingUp, Clock, Shield, Play, RotateCcw, Download, Zap, Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function Succession() {
  const { data: plansData, isLoading, error } = useSuccessionPlans();
  const [expandedPos, setExpandedPos] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simResults, setSimResults] = useState<Record<string, { newReadiness: number; months: number; actions: string[] }> | null>(null);
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [whatIfAdjustments, setWhatIfAdjustments] = useState<Record<string, number>>({});

  if (isLoading) return <div className="p-8 flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /><span className="ml-3 text-muted">加载继任计划...</span></div>;
  if (error) return <div className="p-8 text-center text-red-500">加载失败：{(error as Error).message}</div>;

  const successionPlan = plansData?.items || [];
  const totalRisk = successionPlan.filter(p => p.riskLevel === 'high').length;
  const avgReadiness = successionPlan.length > 0 ? Math.round(successionPlan.reduce((acc, p) => acc + p.successors.reduce((a, s) => a + s.readiness, 0) / p.successors.length, 0) / successionPlan.length) : 0;

  const handleSimulate = () => {
    setSimulating(true);
    setTimeout(() => {
      setSimulating(false);
      const results: Record<string, { newReadiness: number; months: number; actions: string[] }> = {};
      successionPlan.forEach(pos => {
        pos.successors.forEach(s => {
          const key = `${pos.id}-${s.name}`;
          const boost = Math.floor(Math.random() * 15) + 5;
          results[key] = {
            newReadiness: Math.min(100, s.readiness + boost + (whatIfAdjustments[key] || 0)),
            months: Math.floor(Math.random() * 12) + 6,
            actions: [
              '完成高管轮岗项目（3个月）',
              '参加领导力发展计划',
              s.readiness < 80 ? '补充战略管理培训' : '担任代理岗位（1个月）',
            ].slice(0, Math.floor(Math.random() * 2) + 2),
          };
        });
      });
      setSimResults(results);
    }, 2000);
  };

  const handleReset = () => {
    setSimResults(null);
    setWhatIfAdjustments({});
    setWhatIfMode(false);
  };

  const handleExport = () => {
    const content = `蓉才通™ 继任沙盘推演报告\n${'='.repeat(50)}\n\n${successionPlan.map(pos => `【${pos.position}】风险等级: ${pos.riskLevel}\n在任者: ${pos.incumbent.name} (在任${pos.incumbent.tenure}年, ${pos.incumbent.retireIn}年退休)\n继任梯队:\n${pos.successors.map((s, i) => `  ${i + 1}. ${s.name} - 就绪度 ${s.readiness}% - 当前: ${s.currentRole}`).join('\n')}`).join('\n\n')}\n\n---\n平均就绪度: ${avgReadiness}% | 高风险岗位: ${totalRisk}\n四川CA存证 · ${new Date().toLocaleDateString()}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = '继任沙盘推演报告.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">继任沙盘</h1>
          <p className="text-sm text-muted mt-1">Succession Planning · 关键岗位继任梯队管理与推演</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="stat-card px-4 py-2"><p className="text-[10px] text-muted">高风险岗位</p><p className="text-lg font-bold text-risk-600">{totalRisk}</p></div>
          <div className="stat-card px-4 py-2"><p className="text-[10px] text-muted">平均就绪度</p><p className="text-lg font-bold text-brand-600">{avgReadiness}%</p></div>
          <button onClick={() => setWhatIfMode(!whatIfMode)} className={`btn-secondary ${whatIfMode ? 'ring-2 ring-brand-200' : ''}`}>
            <Zap className="w-4 h-4" />What-If
          </button>
          <button onClick={handleSimulate} disabled={simulating} className="btn-primary disabled:opacity-50">
            {simulating ? <><RotateCcw className="w-4 h-4 animate-spin" />推演中...</> : <><Play className="w-4 h-4" />启动推演</>}
          </button>
          {simResults && <button onClick={handleReset} className="btn-ghost"><RotateCcw className="w-4 h-4" />重置</button>}
          <button onClick={handleExport} className="btn-secondary"><Download className="w-4 h-4" />导出</button>
        </div>
      </div>

      {/* What-If Mode Banner */}
      {whatIfMode && (
        <div className="mb-6 p-4 bg-brand-50 rounded-xl border border-brand-100 flex items-center gap-3 animate-in">
          <Zap className="w-5 h-5 text-brand-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-brand-800">What-If 推演模式已开启</p>
            <p className="text-xs text-brand-600">拖动继任者就绪度滑块，模拟不同培养投入下的梯队变化，然后点击"启动推演"查看结果</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {successionPlan.map(pos => {
          const isExpanded = expandedPos === pos.id;
          return (
            <div key={pos.id} className={`glass-card overflow-hidden transition-all ${pos.riskLevel === 'high' ? 'border-l-4 border-l-error-400' : pos.riskLevel === 'medium' ? 'border-l-4 border-l-warning-400' : 'border-l-4 border-l-success-400'}`}>
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-foreground">{pos.position}</h3>
                  <span className={`badge ${pos.riskLevel === 'high' ? 'badge-red' : pos.riskLevel === 'medium' ? 'badge-yellow' : 'badge-green'}`}>
                    {pos.riskLevel === 'high' ? '高风险' : pos.riskLevel === 'medium' ? '中风险' : '低风险'}
                  </span>
                </div>

                {/* Incumbent */}
                <div className="flex items-center gap-3 p-3 bg-ink-50 rounded-xl mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-sm font-bold">{pos.incumbent.name[0]}</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{pos.incumbent.name}</p>
                    <p className="text-xs text-muted">在任 {pos.incumbent.tenure}年</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-warn-600">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs font-medium">{pos.incumbent.retireIn}年退休</span>
                    </div>
                  </div>
                </div>

                {/* Successors */}
                <div className="flex items-center justify-between mb-2">
                  <p className="section-title">继任梯队</p>
                  <button onClick={() => setExpandedPos(isExpanded ? null : pos.id)} className="btn-ghost p-1">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
                <div className="space-y-2">
                  {pos.successors.map((s, i) => {
                    const simKey = `${pos.id}-${s.name}`;
                    const simResult = simResults?.[simKey];
                    const adjustment = whatIfAdjustments[simKey] || 0;
                    const displayReadiness = simResult ? simResult.newReadiness : s.readiness + adjustment;
                    return (
                      <div key={i} className="p-2.5 rounded-lg hover:bg-ink-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${i === 0 ? 'bg-brand-500 text-white' : 'bg-brand-100 text-brand-600'}`}>{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">{s.name}</p>
                            <p className="text-[10px] text-muted">{s.currentRole}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-bold ${displayReadiness >= 80 ? 'text-ok-600' : displayReadiness >= 60 ? 'text-brand-600' : 'text-warn-600'}`}>
                              {displayReadiness}%
                              {simResult && <span className="text-emerald-500 ml-1">↑{simResult.newReadiness - s.readiness}</span>}
                            </p>
                          </div>
                        </div>
                        {/* Readiness bar */}
                        <div className="mt-1.5 ml-8">
                          <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${displayReadiness >= 80 ? 'bg-ok-500' : displayReadiness >= 60 ? 'bg-brand-500' : 'bg-warn-500'}`} style={{ width: `${Math.min(100, displayReadiness)}%` }} />
                          </div>
                        </div>

                        {/* What-If Slider */}
                        {whatIfMode && !simResults && (
                          <div className="mt-2 ml-8 flex items-center gap-2">
                            <span className="text-[10px] text-muted">调整:</span>
                            <input type="range" min="-20" max="30" value={adjustment} onChange={e => setWhatIfAdjustments(prev => ({ ...prev, [simKey]: parseInt(e.target.value) }))} className="flex-1 h-1 accent-primary-500" />
                            <span className={`text-[10px] font-medium ${adjustment > 0 ? 'text-emerald-600' : adjustment < 0 ? 'text-red-600' : 'text-muted'}`}>{adjustment > 0 ? '+' : ''}{adjustment}</span>
                          </div>
                        )}

                        {/* Simulation Results */}
                        {simResult && isExpanded && (
                          <div className="mt-2 ml-8 p-3 bg-emerald-50 rounded-lg border border-emerald-100 animate-in">
                            <p className="text-[10px] font-semibold text-emerald-700 mb-1.5">推演结果 · 预计{simResult.months}个月达成</p>
                            <div className="space-y-1">
                              {simResult.actions.map((action, j) => (
                                <div key={j} className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                  <span className="text-[10px] text-emerald-700">{action}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {isExpanded && !simResult && (
                          <div className="mt-2 ml-8 p-2 bg-ink-50 rounded-lg">
                            <div className="grid grid-cols-3 gap-2 text-[10px]">
                              <div><span className="text-muted">能力评估</span><p className="font-medium text-foreground">{Math.round(s.readiness * 0.9)}/100</p></div>
                              <div><span className="text-muted">经验匹配</span><p className="font-medium text-foreground">{Math.round(s.readiness * 1.05)}/100</p></div>
                              <div><span className="text-muted">发展潜力</span><p className="font-medium text-foreground">{Math.round(s.readiness * 0.95)}/100</p></div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Risk Alert */}
                {pos.riskLevel === 'high' && (
                  <div className="mt-3 p-2.5 bg-risk-50 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-risk-500" />
                    <span className="text-xs text-risk-700">继任梯队就绪度不足，建议加速培养计划</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
