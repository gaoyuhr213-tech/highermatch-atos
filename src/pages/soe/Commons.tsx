import { useTalentCommons } from '../../lib/api/hooks';
import { Users, Building2, ArrowLeftRight, Shield, X, Key, Clock, FileText, CheckCircle2, AlertTriangle, Lock, Unlock, Loader2 } from 'lucide-react';
import { useState } from 'react';

type AuthStep = 'select' | 'scope' | 'sign' | 'complete';

interface ScopedTokenConfig {
  talentId: string;
  talentName: string;
  scopes: string[];
  duration: string;
  purpose: string;
}

const availableScopes = [
  { id: 'profile_read', label: '基本信息查看', desc: '姓名、职级、专业领域', risk: 'low' },
  { id: 'skill_read', label: '技能评估查看', desc: '专业技能评分与认证', risk: 'low' },
  { id: 'history_read', label: '履历查看', desc: '工作经历与项目经验', risk: 'medium' },
  { id: 'contact_read', label: '联系方式查看', desc: '电话、邮箱', risk: 'high' },
  { id: 'schedule_write', label: '排期写入', desc: '安排面谈或借调时间', risk: 'medium' },
  { id: 'evaluation_write', label: '评价写入', desc: '借调期间绩效评价', risk: 'medium' },
];

export default function Commons() {
  const { data: commonsData, isLoading, error } = useTalentCommons();
  const [authModal, setAuthModal] = useState<ScopedTokenConfig | null>(null);
  const [authStep, setAuthStep] = useState<AuthStep>('select');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [duration, setDuration] = useState('30');
  const [purpose, setPurpose] = useState('');
  const [signing, setSigning] = useState(false);
  const [completedTokens, setCompletedTokens] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('all');

  if (isLoading) return <div className="p-8 flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /><span className="ml-3 text-slate-500">加载人才共享数据...</span></div>;
  if (error) return <div className="p-8 text-center text-red-500">加载失败：{(error as Error).message}</div>;

  const talentCommons = commonsData?.items || [];

  const handleStartAuth = (talent: typeof talentCommons[0]) => {
    setAuthModal({ talentId: talent.id, talentName: talent.name, scopes: [], duration: '30', purpose: '' });
    setAuthStep('select');
    setSelectedScopes(['profile_read', 'skill_read']);
    setDuration('30');
    setPurpose('');
  };

  const handleSign = () => {
    setSigning(true);
    setTimeout(() => {
      setSigning(false);
      setAuthStep('complete');
      if (authModal) setCompletedTokens(prev => new Set([...prev, authModal.talentId]));
    }, 2500);
  };

  const filtered = filter === 'all' ? talentCommons : talentCommons.filter(t => filter === 'verified' ? t.caVerified : !t.caVerified);

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">人才共享大厅</h1>
          <p className="text-sm text-slate-500 mt-1">Talent Commons · 国企间人才柔性共享 · ScopedToken授权</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {[{ k: 'all', l: '全部' }, { k: 'verified', l: 'CA认证' }, { k: 'unverified', l: '待认证' }].map(f => (
              <button key={f.k} onClick={() => setFilter(f.k)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filter === f.k ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{f.l}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 rounded-lg border border-primary-100">
            <Key className="w-3.5 h-3.5 text-primary-600" />
            <span className="text-xs text-primary-700 font-medium">已授权Token: {completedTokens.size}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="stat-card"><p className="text-xs text-slate-500">共享池人才</p><p className="text-2xl font-bold text-slate-900">{talentCommons.length}</p></div>
        <div className="stat-card"><p className="text-xs text-slate-500">CA认证率</p><p className="text-2xl font-bold text-trust-600">{talentCommons.length > 0 ? Math.round(talentCommons.filter(t => t.caVerified).length / talentCommons.length * 100) : 0}%</p></div>
        <div className="stat-card"><p className="text-xs text-slate-500">活跃借调</p><p className="text-2xl font-bold text-primary-600">3</p></div>
        <div className="stat-card"><p className="text-xs text-slate-500">本月新增</p><p className="text-2xl font-bold text-emerald-600">+2</p></div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-slate-100 bg-slate-50/50">
            <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500">人才</th>
            <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500">当前单位</th>
            <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500">专业领域</th>
            <th className="text-center px-5 py-3.5 text-xs font-semibold text-slate-500">共享类型</th>
            <th className="text-center px-5 py-3.5 text-xs font-semibold text-slate-500">可用时间</th>
            <th className="text-center px-5 py-3.5 text-xs font-semibold text-slate-500">CA认证</th>
            <th className="text-center px-5 py-3.5 text-xs font-semibold text-slate-500">授权状态</th>
            <th className="text-center px-5 py-3.5 text-xs font-semibold text-slate-500">操作</th>
          </tr></thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                <td className="px-5 py-3.5"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold">{t.name[0]}</div><span className="text-sm font-medium text-slate-800">{t.name}</span></div></td>
                <td className="px-5 py-3.5"><div className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5 text-slate-400" /><span className="text-sm text-slate-600">{t.organization}</span></div></td>
                <td className="px-5 py-3.5"><div className="flex gap-1.5">{t.domains.map(d => <span key={d} className="badge badge-blue text-[10px]">{d}</span>)}</div></td>
                <td className="px-5 py-3.5 text-center"><span className="badge badge-yellow">{t.shareType}</span></td>
                <td className="px-5 py-3.5 text-center text-xs text-slate-600">{t.availableFrom}</td>
                <td className="px-5 py-3.5 text-center">{t.caVerified ? <Shield className="w-4 h-4 text-trust-500 mx-auto" /> : <span className="text-[10px] text-slate-400">待认证</span>}</td>
                <td className="px-5 py-3.5 text-center">
                  {completedTokens.has(t.id) ? (
                    <div className="flex items-center justify-center gap-1"><Unlock className="w-3.5 h-3.5 text-emerald-500" /><span className="text-[10px] text-emerald-600 font-medium">已授权</span></div>
                  ) : (
                    <div className="flex items-center justify-center gap-1"><Lock className="w-3.5 h-3.5 text-slate-300" /><span className="text-[10px] text-slate-400">未授权</span></div>
                  )}
                </td>
                <td className="px-5 py-3.5 text-center">
                  <button onClick={() => handleStartAuth(t)} className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${completedTokens.has(t.id) ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-primary-50 text-primary-600 hover:bg-primary-100'}`}>
                    {completedTokens.has(t.id) ? '查看Token' : '申请授权'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ScopedToken Authorization Modal */}
      {authModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-8" onClick={() => setAuthModal(null)}>
          <div className="bg-white rounded-2xl shadow-elevated w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                  <Key className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">ScopedToken 授权</h2>
                  <p className="text-xs text-slate-500">为 {authModal.talentName} 配置最小权限访问令牌</p>
                </div>
              </div>
              <button onClick={() => setAuthModal(null)} className="btn-ghost p-2"><X className="w-5 h-5" /></button>
            </div>

            {/* Step Indicator */}
            <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-100">
              <div className="flex items-center gap-2">
                {(['select', 'scope', 'sign', 'complete'] as AuthStep[]).map((step, i) => {
                  const labels = ['选择权限', '确认范围', 'U盾签名', '授权完成'];
                  const isCurrent = authStep === step;
                  const isPast = ['select', 'scope', 'sign', 'complete'].indexOf(authStep) > i;
                  return (
                    <div key={step} className="flex items-center gap-2 flex-1">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isPast ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-primary-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                        {isPast ? '✓' : i + 1}
                      </div>
                      <span className={`text-xs ${isCurrent ? 'text-primary-700 font-medium' : 'text-slate-500'}`}>{labels[i]}</span>
                      {i < 3 && <div className={`flex-1 h-px ${isPast ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {authStep === 'select' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-700 font-medium">选择需要授权的数据访问范围：</p>
                  <div className="space-y-2">
                    {availableScopes.map(scope => (
                      <label key={scope.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedScopes.includes(scope.id) ? 'border-primary-200 bg-primary-50/50' : 'border-slate-100 hover:border-slate-200'}`}>
                        <input type="checkbox" checked={selectedScopes.includes(scope.id)} onChange={() => setSelectedScopes(prev => prev.includes(scope.id) ? prev.filter(s => s !== scope.id) : [...prev, scope.id])} className="w-4 h-4 rounded border-slate-300 text-primary-600" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-800">{scope.label}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${scope.risk === 'high' ? 'bg-red-50 text-red-600' : scope.risk === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>{scope.risk === 'high' ? '高敏感' : scope.risk === 'medium' ? '中敏感' : '低敏感'}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{scope.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1.5">有效期</label>
                      <select value={duration} onChange={e => setDuration(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white">
                        <option value="7">7天</option><option value="30">30天</option><option value="90">90天</option><option value="180">180天</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1.5">用途说明</label>
                      <input type="text" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="如：项目借调评估" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400" />
                    </div>
                  </div>
                </div>
              )}

              {authStep === 'scope' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-700 font-medium">请确认以下授权范围：</p>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between"><span className="text-xs text-slate-500">目标人才</span><span className="text-sm font-medium text-slate-800">{authModal.talentName}</span></div>
                    <div className="flex items-center justify-between"><span className="text-xs text-slate-500">有效期</span><span className="text-sm font-medium text-slate-800">{duration}天</span></div>
                    <div className="flex items-center justify-between"><span className="text-xs text-slate-500">用途</span><span className="text-sm font-medium text-slate-800">{purpose || '未填写'}</span></div>
                    <div className="border-t border-slate-200 pt-3">
                      <p className="text-xs text-slate-500 mb-2">授权范围 ({selectedScopes.length}项)</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedScopes.map(s => {
                          const scope = availableScopes.find(as => as.id === s);
                          return <span key={s} className="badge badge-blue">{scope?.label}</span>;
                        })}
                      </div>
                    </div>
                  </div>
                  {selectedScopes.some(s => availableScopes.find(as => as.id === s)?.risk === 'high') && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div><p className="text-xs font-medium text-amber-700">包含高敏感权限</p><p className="text-[10px] text-amber-600 mt-0.5">联系方式等高敏感数据将通过U盾SM2签名加密传输</p></div>
                    </div>
                  )}
                </div>
              )}

              {authStep === 'sign' && (
                <div className="flex flex-col items-center justify-center py-8 space-y-6">
                  {signing ? (
                    <>
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-100 to-trust-100 flex items-center justify-center animate-pulse">
                        <Shield className="w-10 h-10 text-primary-600" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-800">正在进行U盾SM2数字签名...</p>
                        <p className="text-xs text-slate-500 mt-1">请确保U盾已插入并保持连接</p>
                      </div>
                      <div className="w-64 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary-500 to-trust-500 rounded-full animate-pulse" style={{ width: '70%' }} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                        <Key className="w-10 h-10 text-slate-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-800">准备签名</p>
                        <p className="text-xs text-slate-500 mt-1">点击下方按钮使用U盾对ScopedToken进行SM2签名</p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {authStep === 'complete' && (
                <div className="flex flex-col items-center justify-center py-8 space-y-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-100 to-trust-100 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-900">授权成功</p>
                    <p className="text-sm text-slate-500 mt-1">ScopedToken 已生成并经CA签名存证</p>
                  </div>
                  <div className="w-full max-w-md p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between"><span className="text-xs text-slate-500">Token ID</span><span className="text-xs font-mono text-slate-700">SCT-{Date.now().toString(36).toUpperCase()}</span></div>
                    <div className="flex items-center justify-between"><span className="text-xs text-slate-500">SM2签名</span><span className="text-xs font-mono text-trust-600">SM2:9f3a...c7d2</span></div>
                    <div className="flex items-center justify-between"><span className="text-xs text-slate-500">SM3存证</span><span className="text-xs font-mono text-trust-600">SM3:4b8e...a1f5</span></div>
                    <div className="flex items-center justify-between"><span className="text-xs text-slate-500">有效期至</span><span className="text-xs text-slate-700">{new Date(Date.now() + parseInt(duration) * 86400000).toLocaleDateString()}</span></div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-trust-500" />
                <span className="text-xs text-slate-500">最小权限原则 · U盾SM2签名 · 四川CA存证</span>
              </div>
              <div className="flex items-center gap-2">
                {authStep !== 'complete' && <button onClick={() => setAuthModal(null)} className="btn-secondary text-xs">取消</button>}
                {authStep === 'select' && <button onClick={() => setAuthStep('scope')} disabled={selectedScopes.length === 0} className="btn-primary text-xs disabled:opacity-50">下一步</button>}
                {authStep === 'scope' && <button onClick={() => setAuthStep('sign')} className="btn-primary text-xs">确认并签名</button>}
                {authStep === 'sign' && !signing && <button onClick={handleSign} className="btn-primary text-xs">U盾签名</button>}
                {authStep === 'complete' && <button onClick={() => setAuthModal(null)} className="btn-primary text-xs">完成</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
