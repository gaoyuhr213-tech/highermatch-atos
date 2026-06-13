import { useGraphNodes, useGraphEdges } from '../../lib/api/hooks';
import { ZoomIn, ZoomOut, Maximize2, Shield, X, User, Building2, Code, Briefcase, Search, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { GraphNode } from '../../lib/api/types';

const typeColors: Record<string, string> = { talent: '#2563EB', company: '#10B981', skill: '#F59E0B', position: '#8B5CF6' };
const typeLabels: Record<string, string> = { talent: '人才', company: '企业', skill: '技能', position: '岗位' };
const typeIcons: Record<string, typeof User> = { talent: User, company: Building2, skill: Code, position: Briefcase };
const edgeTypeLabels: Record<string, string> = { employed_at: '任职于', has_skill: '具备技能', referred_by: '推荐关系' };

export default function Graph() {
  const { data: nodesData, isLoading: nodesLoading, error: nodesError } = useGraphNodes();
  const { data: edgesData, isLoading: edgesLoading, error: edgesError } = useGraphEdges();
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);

  const isLoading = nodesLoading || edgesLoading;
  const graphNodes = nodesData?.items || [];
  const graphEdges = edgesData?.items || [];

  const getConnectedNodes = (nodeId: string) => {
    const edgeIds = graphEdges.filter(e => e.source === nodeId || e.target === nodeId).map(e => e.source === nodeId ? e.target : e.source);
    return graphNodes.filter(n => edgeIds.includes(n.id));
  };

  const getNodeEdges = (nodeId: string) => graphEdges.filter(e => e.source === nodeId || e.target === nodeId);

  const filteredNodes = searchTerm ? graphNodes.filter(n => n.name.toLowerCase().includes(searchTerm.toLowerCase())) : graphNodes;
  const highlightedIds = new Set(filteredNodes.map(n => n.id));

  const error = nodesError || edgesError;
  if (isLoading) return <div className="p-8 flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /><span className="ml-3 text-muted">加载人才图谱...</span></div>;
  if (error) return <div className="p-8 text-center text-red-500">加载失败：{(error as Error).message}</div>;

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-foreground">人才图谱</h1><p className="text-sm text-muted mt-1">Knowledge Graph · 关系穿透 · CA签名边验证 · 节点下钻</p></div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="搜索节点..." className="pl-9 pr-3 py-1.5 text-sm border border-border rounded-lg bg-surface focus:ring-2 focus:ring-brand-200 focus:border-brand-300 w-44" />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
            <input type="checkbox" checked={showEdgeLabels} onChange={e => setShowEdgeLabels(e.target.checked)} className="rounded border-ink-300" />
            边标签
          </label>
          <button onClick={() => setZoom(z => Math.min(z + 0.2, 2))} className="btn-ghost"><ZoomIn className="w-4 h-4" /></button>
          <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))} className="btn-ghost"><ZoomOut className="w-4 h-4" /></button>
          <button onClick={() => setZoom(1)} className="btn-ghost"><Maximize2 className="w-4 h-4" /></button>
          <span className="text-xs text-muted">{Math.round(zoom * 100)}%</span>
        </div>
      </div>
      <div className="flex-1 flex gap-6 min-h-0">
        <div className="flex-1 glass-card overflow-hidden relative">
          <svg width="100%" height="100%" viewBox="0 0 800 600" style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
            {/* Edges */}
            {graphEdges.map((e, i) => {
              const s = graphNodes.find(n => n.id === e.source);
              const t = graphNodes.find(n => n.id === e.target);
              if (!s || !t) return null;
              const isHighlighted = selected && (e.source === selected.id || e.target === selected.id);
              const isHoverHighlighted = hovered && (e.source === hovered || e.target === hovered);
              const midX = (s.x + t.x) / 2;
              const midY = (s.y + t.y) / 2;
              return (
                <g key={i}>
                  <line x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                    stroke={isHighlighted ? '#2563EB' : isHoverHighlighted ? '#60A5FA' : e.caSigned ? '#10B981' : '#CBD5E1'}
                    strokeWidth={isHighlighted ? e.weight * 4 : e.weight * 3}
                    strokeDasharray={e.caSigned ? '' : '4 2'}
                    opacity={selected ? (isHighlighted ? 1 : 0.15) : isHoverHighlighted ? 0.9 : 0.6}
                    className="transition-all duration-200" />
                  {/* CA badge on edge */}
                  {e.caSigned && (
                    <g transform={`translate(${midX}, ${midY})`}>
                      <rect x="-12" y="-8" width="24" height="16" rx="4" fill="#10B981" opacity={selected ? (isHighlighted ? 0.9 : 0.1) : 0.8} />
                      <text x="0" y="4" textAnchor="middle" fill="white" className="text-[7px] font-bold" opacity={selected ? (isHighlighted ? 1 : 0.1) : 1}>CA✓</text>
                    </g>
                  )}
                  {/* Edge type label */}
                  {showEdgeLabels && !e.caSigned && (
                    <text x={midX} y={midY - 6} textAnchor="middle" className="text-[8px]" fill="#94A3B8" opacity={selected ? (isHighlighted ? 1 : 0.1) : 0.7}>
                      {edgeTypeLabels[e.type] || e.type}
                    </text>
                  )}
                  {showEdgeLabels && e.caSigned && (
                    <text x={midX} y={midY + 16} textAnchor="middle" className="text-[8px]" fill="#10B981" opacity={selected ? (isHighlighted ? 1 : 0.1) : 0.7}>
                      {edgeTypeLabels[e.type] || e.type}
                    </text>
                  )}
                </g>
              );
            })}
            {/* Nodes */}
            {graphNodes.map(n => {
              const isSelected = selected?.id === n.id;
              const isConnected = selected ? getConnectedNodes(selected.id).some(cn => cn.id === n.id) : false;
              const dimmed = selected ? (!isSelected && !isConnected) : (searchTerm && !highlightedIds.has(n.id));
              return (
                <g key={n.id} className="cursor-pointer" onClick={() => setSelected(isSelected ? null : n)}
                  onMouseEnter={() => setHovered(n.id)} onMouseLeave={() => setHovered(null)}>
                  <circle cx={n.x} cy={n.y} r={22 + n.connections * 0.3} fill={typeColors[n.type]}
                    opacity={dimmed ? 0.05 : isSelected ? 0.25 : hovered === n.id ? 0.2 : 0.12}
                    className="transition-all duration-200" />
                  <circle cx={n.x} cy={n.y} r={isSelected ? 16 : 14} fill={typeColors[n.type]}
                    opacity={dimmed ? 0.3 : 0.9} stroke={isSelected ? '#fff' : 'none'} strokeWidth={2}
                    className="transition-all duration-200" />
                  <text x={n.x} y={n.y + 32} textAnchor="middle" className="text-[11px] font-medium" fill={dimmed ? '#CBD5E1' : '#334155'}>{n.name}</text>
                  {n.caVerified && (
                    <g transform={`translate(${n.x + 12}, ${n.y - 12})`}>
                      <circle r="7" fill="#10B981" stroke="#fff" strokeWidth={1.5} />
                      <text x="0" y="3.5" textAnchor="middle" fill="white" className="text-[7px] font-bold">CA</text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-surface/90 backdrop-blur-sm rounded-xl p-3 border border-border shadow-sm">
            <p className="text-[10px] font-semibold text-muted mb-2">图例</p>
            <div className="space-y-1.5">
              {Object.entries(typeLabels).map(([k, v]) => (<div key={k} className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ background: typeColors[k] }} /><span className="text-[10px] text-muted">{v}</span></div>))}
              <div className="border-t border-border pt-1.5 mt-1.5">
                <div className="flex items-center gap-2"><div className="w-6 h-0.5 bg-emerald-500" /><span className="text-[10px] text-muted">CA签名边</span></div>
                <div className="flex items-center gap-2 mt-1"><div className="w-6 h-0.5 bg-ink-300 border-dashed border-t" /><span className="text-[10px] text-muted">未签名边</span></div>
              </div>
              <div className="flex items-center gap-2"><Shield className="w-3 h-3 text-trust-500" /><span className="text-[10px] text-muted">CA验证节点</span></div>
            </div>
          </div>
          {!selected && <div className="absolute top-4 left-4 bg-surface/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-border"><p className="text-xs text-muted">点击节点查看详情与关联关系</p></div>}
        </div>
        {/* Detail Panel */}
        {selected && (
          <div className="w-80 glass-card p-5 flex flex-col overflow-y-auto animate-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">节点详情</h3>
              <button onClick={() => setSelected(null)} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-ink-50">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: typeColors[selected.type] + '20' }}>
                {(() => { const Icon = typeIcons[selected.type]; return <Icon className="w-5 h-5" style={{ color: typeColors[selected.type] }} />; })()}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{selected.name}</p>
                <p className="text-xs text-muted">{typeLabels[selected.type]} · {selected.connections}个关联</p>
              </div>
            </div>
            {selected.caVerified && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-trust-50 border border-trust-100 mb-4">
                <Shield className="w-4 h-4 text-trust-600" />
                <div>
                  <span className="text-xs text-trust-700 font-medium">CA数字签名已验证</span>
                  <p className="text-[10px] text-trust-600 mt-0.5">四川CA · SM2签名 · 有效期至2025-12-31</p>
                </div>
              </div>
            )}
            <div className="mb-4">
              <p className="section-title mb-2">关联关系 ({getNodeEdges(selected.id).length})</p>
              <div className="space-y-2">
                {getConnectedNodes(selected.id).map(cn => (
                  <div key={cn.id} onClick={() => setSelected(cn)} className="flex items-center gap-2 p-2 rounded-lg hover:bg-ink-50 cursor-pointer transition-colors">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: typeColors[cn.type] + '20' }}>
                      <div className="w-3 h-3 rounded-full" style={{ background: typeColors[cn.type] }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{cn.name}</p>
                      <p className="text-[10px] text-muted">{typeLabels[cn.type]}</p>
                    </div>
                    {cn.caVerified && <Shield className="w-3 h-3 text-trust-500" />}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="section-title mb-2">关系边属性</p>
              <div className="space-y-1.5">
                {getNodeEdges(selected.id).map((e, i) => {
                  const other = graphNodes.find(n => n.id === (e.source === selected.id ? e.target : e.source));
                  return (
                    <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-ink-50">
                      <div className="flex items-center gap-1.5">
                        {e.caSigned && <Shield className="w-3 h-3 text-trust-500" />}
                        <span className="text-muted">{edgeTypeLabels[e.type] || e.type} → {other?.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted">权重 {e.weight}</span>
                        {e.caSigned && <span className="text-[9px] px-1 py-0.5 bg-trust-50 text-trust-600 rounded">CA✓</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
