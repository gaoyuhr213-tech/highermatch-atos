import { useState, useCallback } from 'react';
import { pipelineCandidates } from '../../data/mock-data';
import type { PipelineCandidate } from '../../data/mock-data';
import { DndContext, closestCenter, useDraggable, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { AlertTriangle, Download, Filter, X, CheckSquare, Square, Shield, Lock, Unlock, Flag } from 'lucide-react';

const stages = [
  { key: 'sourcing', label: '寻访', color: 'border-t-slate-400' },
  { key: 'screening', label: '筛选', color: 'border-t-primary-400' },
  { key: 'interviewing', label: '面试', color: 'border-t-amber-400' },
  { key: 'risk_check', label: '风控', color: 'border-t-red-400' },
  { key: 'offering', label: 'Offer', color: 'border-t-emerald-400' },
  { key: 'signed', label: '已签', color: 'border-t-green-500' },
] as const;

const featureFlags = [
  { key: 'auto_advance', label: '自动推进', desc: '匹配度≥90%自动进入下一阶段', enabled: true },
  { key: 'suspend_gate', label: 'SuspendGate', desc: '风控检查未通过时自动挂起', enabled: true },
  { key: 'batch_ops', label: '批量操作', desc: '支持多选候选人批量操作', enabled: true },
  { key: 'ai_ranking', label: 'AI排序', desc: '按AI综合评分自动排序', enabled: false },
];

function DroppableColumn({ id, label, color, count, children }: { id: string; label: string; color: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`rounded-2xl p-3 border-t-2 ${color} transition-colors min-h-[500px] ${isOver ? 'bg-primary-50/60 ring-2 ring-primary-200' : 'bg-slate-50/80'}`}>
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-semibold text-slate-600 uppercase">{label}</span>
        <span className="text-[10px] bg-white border border-slate-200 rounded-full px-2 py-0.5 text-slate-500 font-medium">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DraggableCard({ candidate, selected, onSelect, onContextMenu, onSuspendClick }: { candidate: PipelineCandidate; selected: boolean; onSelect: (id: string) => void; onContextMenu: (e: React.MouseEvent, id: string) => void; onSuspendClick: (c: PipelineCandidate) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: candidate.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 50 : 1 } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      onContextMenu={(e) => onContextMenu(e, candidate.id)}
      className={`bg-white rounded-xl p-3 shadow-card hover:shadow-card-hover transition-all cursor-grab active:cursor-grabbing border ${selected ? 'border-primary-400 ring-2 ring-primary-100' : candidate.suspendGate ? 'border-amber-200' : 'border-slate-100'}`}>
      <div className="flex items-center gap-2 mb-2">
        <button onClick={(e) => { e.stopPropagation(); onSelect(candidate.id); }} className="flex-shrink-0">
          {selected ? <CheckSquare className="w-4 h-4 text-primary-500" /> : <Square className="w-4 h-4 text-slate-300" />}
        </button>
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-[10px] font-bold">{candidate.avatar}</div>
        <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-800 truncate">{candidate.name}</p><p className="text-[10px] text-slate-400 truncate">{candidate.position}</p></div>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 bg-slate-100 rounded-full h-1.5"><div className="h-full bg-primary-500 rounded-full" style={{ width: `${candidate.matchScore}%` }} /></div>
        <span className="text-[10px] font-medium text-primary-600">{candidate.matchScore}%</span>
      </div>
      {candidate.suspendGate && (
        <button onClick={(e) => { e.stopPropagation(); onSuspendClick(candidate); }} className="w-full flex items-center gap-1.5 p-1.5 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer">
          <Lock className="w-3 h-3 text-amber-500" />
          <span className="text-[10px] text-amber-700 font-medium">{candidate.suspendGate}</span>
        </button>
      )}
      <div className="flex flex-wrap gap-1 mt-2">{candidate.tags.slice(0, 2).map(t => <span key={t} className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">{t}</span>)}</div>
    </div>
  );
}

export default function Pipeline() {
  const [candidates, setCandidates] = useState<PipelineCandidate[]>(pipelineCandidates);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; candidateId: string } | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [filterScore, setFilterScore] = useState(0);
  const [suspendModal, setSuspendModal] = useState<PipelineCandidate | null>(null);
  const [resolving, setResolving] = useState(false);
  const [showFlags, setShowFlags] = useState(false);
  const [flags, setFlags] = useState(featureFlags);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const targetStage = over.id as string;
    const candidate = candidates.find(c => c.id === active.id);
    // SuspendGate: block advancement if gate is active
    if (candidate?.suspendGate && stages.findIndex(s => s.key === targetStage) > stages.findIndex(s => s.key === candidate.stage)) {
      setSuspendModal(candidate);
      return;
    }
    if (stages.some(s => s.key === targetStage)) {
      setCandidates(prev => prev.map(c => c.id === active.id ? { ...c, stage: targetStage as PipelineCandidate['stage'] } : c));
    }
  };

  const handleResolveGate = () => {
    setResolving(true);
    setTimeout(() => {
      setResolving(false);
      if (suspendModal) {
        setCandidates(prev => prev.map(c => c.id === suspendModal.id ? { ...c, suspendGate: undefined } : c));
      }
      setSuspendModal(null);
    }, 2000);
  };

  const handleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, candidateId: id });
  };

  const moveToStage = (stage: string) => {
    if (!contextMenu) return;
    const candidate = candidates.find(c => c.id === contextMenu.candidateId);
    if (candidate?.suspendGate) { setSuspendModal(candidate); setContextMenu(null); return; }
    setCandidates(prev => prev.map(c => c.id === contextMenu.candidateId ? { ...c, stage: stage as PipelineCandidate['stage'] } : c));
    setContextMenu(null);
  };

  const batchMoveToStage = (stage: string) => {
    setCandidates(prev => prev.map(c => selectedIds.has(c.id) ? { ...c, stage: stage as PipelineCandidate['stage'] } : c));
    setSelectedIds(new Set());
  };

  const handleExport = useCallback(() => {
    const csv = ['姓名,职位,阶段,匹配度,标签,暂停门'].concat(
      candidates.map(c => `${c.name},${c.position},${c.stage},${c.matchScore}%,"${c.tags.join(',')}",${c.suspendGate || '无'}`)
    ).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'pipeline_export.csv'; a.click();
    URL.revokeObjectURL(url);
  }, [candidates]);

  const filteredCandidates = filterScore > 0 ? candidates.filter(c => c.matchScore >= filterScore) : candidates;

  return (
    <div className="p-8" onClick={() => setContextMenu(null)}>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-slate-900">招聘流水线</h1><p className="text-sm text-slate-500 mt-1">Pipeline Kanban · 拖拽推进 · SuspendGate挂起 · 右键快捷操作</p></div>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 rounded-lg border border-primary-100">
              <span className="text-xs text-primary-700 font-medium">{selectedIds.size} 已选</span>
              <select onChange={e => { if (e.target.value) batchMoveToStage(e.target.value); e.target.value = ''; }} className="text-xs border border-primary-200 rounded px-2 py-0.5 bg-white text-primary-700">
                <option value="">批量移至...</option>
                {stages.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          )}
          <button onClick={() => setShowFlags(!showFlags)} className={`btn-secondary ${showFlags ? 'ring-2 ring-primary-200' : ''}`}><Flag className="w-4 h-4" />Feature Flags</button>
          <button onClick={() => setShowFilter(!showFilter)} className={`btn-secondary ${showFilter ? 'border-primary-300' : ''}`}><Filter className="w-4 h-4" />筛选</button>
          <button onClick={handleExport} className="btn-secondary"><Download className="w-4 h-4" />导出Excel</button>
        </div>
      </div>

      {/* Feature Flags Panel */}
      {showFlags && (
        <div className="glass-card p-4 mb-4 animate-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">Feature Flags 控制面板</h3>
            <span className="text-[10px] text-slate-400">Demo环境 · 实时生效</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {flags.map((f, i) => (
              <div key={f.key} className={`p-3 rounded-xl border transition-all ${f.enabled ? 'border-primary-200 bg-primary-50/50' : 'border-slate-100 bg-slate-50'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-700">{f.label}</span>
                  <button onClick={() => setFlags(prev => prev.map((fl, j) => j === i ? { ...fl, enabled: !fl.enabled } : fl))} className={`w-8 h-4 rounded-full transition-colors relative ${f.enabled ? 'bg-primary-500' : 'bg-slate-300'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${f.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showFilter && (
        <div className="glass-card p-4 mb-4 flex items-center gap-4">
          <span className="text-xs text-slate-600">最低匹配度:</span>
          <input type="range" min="0" max="95" step="5" value={filterScore} onChange={e => setFilterScore(Number(e.target.value))} className="w-40" />
          <span className="text-xs font-medium text-primary-600">{filterScore}%</span>
          <span className="text-xs text-slate-400 ml-4">显示 {filteredCandidates.length}/{candidates.length} 候选人</span>
        </div>
      )}

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-6 gap-4">
          {stages.map(stage => {
            const items = filteredCandidates.filter(c => c.stage === stage.key);
            return (
              <DroppableColumn key={stage.key} id={stage.key} label={stage.label} color={stage.color} count={items.length}>
                {items.map(c => <DraggableCard key={c.id} candidate={c} selected={selectedIds.has(c.id)} onSelect={handleSelect} onContextMenu={handleContextMenu} onSuspendClick={setSuspendModal} />)}
                {items.length === 0 && <p className="text-xs text-slate-400 text-center py-8">拖拽至此</p>}
              </DroppableColumn>
            );
          })}
        </div>
      </DndContext>

      {/* Context Menu */}
      {contextMenu && (
        <div className="fixed bg-white rounded-xl shadow-elevated border border-slate-100 py-2 w-44 z-50" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <p className="px-3 py-1 text-[10px] text-slate-400 uppercase">移至阶段</p>
          {stages.map(s => (
            <button key={s.key} onClick={() => moveToStage(s.key)} className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-primary-50 hover:text-primary-700 transition-colors">{s.label}</button>
          ))}
          <div className="border-t border-slate-100 mt-1 pt-1">
            <button className="w-full text-left px-3 py-1.5 text-sm text-error-600 hover:bg-error-50 transition-colors">淘汰</button>
          </div>
        </div>
      )}

      {/* SuspendGate Modal */}
      {suspendModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => !resolving && setSuspendModal(null)}>
          <div className="bg-white rounded-2xl shadow-elevated w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center"><Lock className="w-5 h-5 text-amber-600" /></div>
              <div>
                <h3 className="text-base font-bold text-slate-900">SuspendGate 挂起</h3>
                <p className="text-xs text-slate-500">候选人推进被阻断，需解除风控门禁</p>
              </div>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">{suspendModal.suspendGate}</span>
              </div>
              <p className="text-xs text-amber-700 ml-6">候选人 <strong>{suspendModal.name}</strong> 在当前阶段被SuspendGate挂起，需要人工审核或补充材料后方可推进。</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl mb-4">
              <p className="text-xs text-slate-500 mb-2">解除条件：</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2"><Shield className="w-3 h-3 text-trust-500" /><span className="text-xs text-slate-600">CA签名确认风控审核通过</span></div>
                <div className="flex items-center gap-2"><Shield className="w-3 h-3 text-trust-500" /><span className="text-xs text-slate-600">补充背调材料并验证</span></div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setSuspendModal(null)} disabled={resolving} className="btn-secondary flex-1">保持挂起</button>
              <button onClick={handleResolveGate} disabled={resolving} className="btn-primary flex-1">
                {resolving ? (
                  <><Unlock className="w-4 h-4 animate-spin" />解除中...</>
                ) : (
                  <><Unlock className="w-4 h-4" />U盾签名解除</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
