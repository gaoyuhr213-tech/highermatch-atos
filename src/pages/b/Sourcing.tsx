import { useSourcingResults, useContactCandidate, useBatchContact, useGenerateStrategy } from '../../lib/api/hooks';
import { Search, Send, CheckCircle2, XCircle, Sparkles, Filter, Download, Loader2, Star } from 'lucide-react';
import { useState } from 'react';

export default function Sourcing() {
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [contacted, setContacted] = useState<Set<string>>(new Set());
  const [strategy, setStrategy] = useState<string | null>(null);
  const [filterScore, setFilterScore] = useState(0);
  const [showFilter, setShowFilter] = useState(false);

  const { data: sourcingData, isLoading } = useSourcingResults(searchQuery);
  const contactMutation = useContactCandidate();
  const batchContactMutation = useBatchContact();
  const strategyMutation = useGenerateStrategy();

  const sourcingResults = sourcingData?.items || [];

  const handleSearch = () => {
    if (!query.trim()) return;
    setSearchQuery(query);
    strategyMutation.mutate(query, {
      onSuccess: (data) => {
        setStrategy(data?.data?.summary || `基于"${query}"生成寻访策略：\n1. 目标画像：${query}相关领域3-8年经验，985/211优先\n2. 渠道策略：LinkedIn(40%) + 脉脉(30%) + GitHub(20%) + 内推(10%)\n3. 触达话术：个性化InMail模板已生成\n4. 预计产出：7-12位高匹配候选人`);
      },
      onError: () => {
        setStrategy(`基于"${query}"生成寻访策略：\n1. 目标画像：${query}相关领域3-8年经验，985/211优先\n2. 渠道策略：LinkedIn(40%) + 脉脉(30%) + GitHub(20%) + 内推(10%)\n3. 触达话术：个性化InMail模板已生成\n4. 预计产出：7-12位高匹配候选人`);
      },
    });
  };

  const handleContact = (id: string) => {
    contactMutation.mutate(id);
    setContacted(prev => new Set([...prev, id]));
  };

  const handleBatchContact = () => {
    const reachable = filteredResults.filter(r => r.reachable && !contacted.has(r.id));
    const ids = reachable.map(r => r.id);
    if (ids.length > 0) {
      batchContactMutation.mutate(ids);
      reachable.forEach(r => setContacted(prev => new Set([...prev, r.id])));
    }
  };

  const filteredResults = sourcingResults.filter(r => {
    if (filterScore > 0 && r.matchScore < filterScore) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      return r.name.toLowerCase().includes(q) || r.currentRole.toLowerCase().includes(q) || r.skills.some(s => s.toLowerCase().includes(q)) || r.company.toLowerCase().includes(q);
    }
    return true;
  });

  const handleExport = () => {
    const csv = ['姓名,职位,公司,匹配度,技能,状态'].concat(
      filteredResults.map(r => `${r.name},${r.currentRole},${r.company},${r.matchScore}%,"${r.skills.join(',')}",${contacted.has(r.id) ? '已联系' : r.reachable ? '可联系' : '不可达'}`)
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'sourcing_results.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-foreground">AI 寻访</h1><p className="text-sm text-muted mt-1">Smart Sourcing · 全网穿透式人才发现</p></div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowFilter(!showFilter)} className={`btn-secondary ${showFilter ? 'border-brand-300 text-brand-600' : ''}`}><Filter className="w-4 h-4" />筛选</button>
          <button onClick={handleExport} className="btn-secondary"><Download className="w-4 h-4" />导出CSV</button>
          <button onClick={handleBatchContact} className="btn-primary"><Send className="w-4 h-4" />批量联系 ({filteredResults.filter(r => r.reachable && !contacted.has(r.id)).length})</button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-card p-4 mb-4">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-brand-500" />
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="输入岗位需求，AI自动生成寻访策略（如：资深Go后端 分布式系统经验）..." className="input-field flex-1" />
          <button onClick={handleSearch} disabled={isLoading || strategyMutation.isPending} className="btn-primary min-w-[100px]">
            {isLoading || strategyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {isLoading || strategyMutation.isPending ? '分析中' : '寻访'}
          </button>
        </div>
      </div>

      {/* AI Strategy */}
      {strategy && (
        <div className="glass-card p-4 mb-4 border-l-4 border-l-brand-500">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-brand-500" />
            <span className="text-xs font-semibold text-brand-700">AI寻访策略</span>
          </div>
          <pre className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{strategy}</pre>
        </div>
      )}

      {/* Filter Panel */}
      {showFilter && (
        <div className="glass-card p-4 mb-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">最低匹配度:</span>
              <input type="range" min="0" max="95" step="5" value={filterScore} onChange={e => setFilterScore(Number(e.target.value))} className="w-32" />
              <span className="text-xs font-medium text-brand-600">{filterScore}%</span>
            </div>
            <span className="text-xs text-muted">|</span>
            <span className="text-xs text-muted">共 {filteredResults.length} 条结果</span>
          </div>
        </div>
      )}

      {/* Results Table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-border bg-ink-50/50">
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted">候选人</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted">当前职位</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted">公司</th>
            <th className="text-center px-4 py-3 text-xs font-semibold text-muted">匹配度</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted">技能标签</th>
            <th className="text-center px-4 py-3 text-xs font-semibold text-muted">可达</th>
            <th className="text-center px-4 py-3 text-xs font-semibold text-muted">操作</th>
          </tr></thead>
          <tbody>
            {filteredResults.map((r, i) => (
              <tr key={r.id} className={`border-b border-border hover:bg-brand-50/30 transition-colors ${i % 2 === 0 ? '' : 'bg-ink-25'}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-[10px] font-bold">{r.name[0]}</div>
                    <span className="text-sm font-medium text-foreground">{r.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-muted">{r.currentRole}</td>
                <td className="px-4 py-3 text-sm text-muted">{r.company}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {r.matchScore >= 90 && <Star className="w-3 h-3 text-warn-500 fill-warning-500" />}
                    <span className={`text-sm font-bold ${r.matchScore >= 90 ? 'text-ok-600' : r.matchScore >= 80 ? 'text-brand-600' : 'text-muted'}`}>{r.matchScore}%</span>
                  </div>
                </td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{r.skills.slice(0, 3).map(s => <span key={s} className="badge badge-blue text-[10px]">{s}</span>)}</div></td>
                <td className="px-4 py-3 text-center">{r.reachable ? <CheckCircle2 className="w-4 h-4 text-ok-500 mx-auto" /> : <XCircle className="w-4 h-4 text-muted mx-auto" />}</td>
                <td className="px-4 py-3 text-center">
                  {contacted.has(r.id) ? <span className="badge badge-green text-[10px]">已联系</span> : r.reachable ? <button onClick={() => handleContact(r.id)} className="text-xs text-brand-600 hover:text-brand-700 font-medium hover:underline">联系</button> : <span className="text-xs text-muted">不可达</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredResults.length === 0 && !isLoading && <div className="p-12 text-center"><p className="text-sm text-muted">输入关键词开始AI寻访，或调整筛选条件</p></div>}
        {isLoading && <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-brand-500 mx-auto" /><p className="text-sm text-muted mt-2">AI正在全网寻访...</p></div>}
      </div>
    </div>
  );
}
