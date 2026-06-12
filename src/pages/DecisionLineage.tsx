import { decisionLineage } from '../data/mock-data';
import { X, Shield, Bot, FileText, GitBranch, CheckCircle2, AlertTriangle, Hash, Copy, Download, ExternalLink, Lock, Cpu, Code2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState, useCallback } from 'react';

interface Props { onClose: () => void; }

export default function DecisionLineage({ onClose }: Props) {
  const [expandedStep, setExpandedStep] = useState<number>(0);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [showModelInfo, setShowModelInfo] = useState<number | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleVerify = () => {
    setVerifying(true);
    setTimeout(() => { setVerifying(false); setVerified(true); }, 2500);
  };

  const handleCopyHash = useCallback((hash: string, id: string) => {
    navigator.clipboard?.writeText(hash);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  }, []);

  const handleExportPdf = () => {
    setExportingPdf(true);
    setTimeout(() => {
      setExportingPdf(false);
      const blob = new Blob([`蓉才通™ 决策血统追溯报告\n${'='.repeat(50)}\n\n候选人: 张明远\n岗位: 高级算法工程师\n最终置信度: 92%\nLineage Hash Chain: SM3:1a2b→5e6f→9i0j→3m4n→7q8r→1u2v\n\n${decisionLineage.map(s => `[${s.phase}] ${s.actor} - ${s.action}\n  SM3: ${s.sm3Hash}\n  证据: ${s.evidenceLinks.map(e => `${e.type}(${e.source}, ${(e.confidence*100).toFixed(0)}%)`).join(', ')}\n  ${s.caSignature ? `CA签名: ${s.caSignature}` : ''}`).join('\n\n')}\n\n---\n四川CA存证 · 全链路SM2签名 · 不可篡改`], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = '决策血统追溯_张明远_高级算法工程师.txt'; a.click();
      URL.revokeObjectURL(url);
    }, 1500);
  };

  const totalEvidence = decisionLineage.reduce((acc, s) => acc + s.evidenceLinks.length, 0);
  const totalCounterEvidence = decisionLineage.reduce((acc, s) => acc + (s.counterEvidence?.length || 0), 0);
  const signedSteps = decisionLineage.filter(s => s.caSignature).length;
  const hashChain = decisionLineage.map(s => s.sm3Hash.split(':')[1]?.split('...')[0] || '').join('→');

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-elevated w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-md">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">决策血统追溯</h2>
              <p className="text-xs text-slate-500">Decision Lineage · 全链路可信证据链 · Ctrl+L</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {verified && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-trust-50 rounded-lg border border-trust-200 animate-in">
                <Shield className="w-3.5 h-3.5 text-trust-600" />
                <span className="text-xs text-trust-700 font-medium">全链路签名已验证 ✓</span>
              </div>
            )}
            <button onClick={onClose} className="btn-ghost p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Summary Bar - Enhanced */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-primary-50/30 border-b border-slate-100">
          <div className="grid grid-cols-7 gap-4">
            <div><p className="text-[10px] text-slate-400 uppercase tracking-wider">候选人</p><p className="text-sm font-semibold text-slate-800">张明远</p></div>
            <div><p className="text-[10px] text-slate-400 uppercase tracking-wider">岗位</p><p className="text-sm font-semibold text-slate-800">高级算法工程师</p></div>
            <div><p className="text-[10px] text-slate-400 uppercase tracking-wider">最终置信度</p><p className="text-sm font-bold text-primary-600">92%</p></div>
            <div><p className="text-[10px] text-slate-400 uppercase tracking-wider">正面证据</p><p className="text-sm font-semibold text-emerald-600">{totalEvidence}条</p></div>
            <div><p className="text-[10px] text-slate-400 uppercase tracking-wider">反面证据</p><p className="text-sm font-semibold text-amber-600">{totalCounterEvidence}条</p></div>
            <div><p className="text-[10px] text-slate-400 uppercase tracking-wider">CA签名步骤</p><p className="text-sm font-semibold text-trust-600">{signedSteps}/{decisionLineage.length}</p></div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Hash Chain</p>
              <p className="text-[10px] font-mono text-slate-600 truncate cursor-pointer hover:text-primary-600" title={hashChain} onClick={() => handleCopyHash(hashChain, 'chain')}>
                {copiedHash === 'chain' ? '已复制 ✓' : `${hashChain.slice(0, 20)}...`}
              </p>
            </div>
          </div>
        </div>

        {/* Timeline - Enhanced */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-primary-200 via-slate-200 to-trust-200" />
            {decisionLineage.map((step, i) => {
              const isExpanded = expandedStep === i;
              const hasCa = !!step.caSignature;
              const hasCounter = step.counterEvidence && step.counterEvidence.length > 0;
              const isModelExpanded = showModelInfo === i;
              return (
                <div key={step.id} className="relative pl-14 pb-6 last:pb-0">
                  {/* Timeline Node */}
                  <div className={`absolute left-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${hasCa ? 'bg-trust-500 border-trust-500 shadow-sm shadow-trust-200' : hasCounter ? 'bg-warning-500 border-warning-500' : 'bg-primary-100 border-primary-300'}`}>
                    {hasCa ? <Lock className="w-2.5 h-2.5 text-white" /> : hasCounter ? <AlertTriangle className="w-2.5 h-2.5 text-white" /> : <div className="w-2 h-2 rounded-full bg-primary-500" />}
                  </div>

                  <div className={`rounded-xl border transition-all cursor-pointer ${isExpanded ? 'bg-white border-primary-200 shadow-card ring-1 ring-primary-100' : 'bg-slate-50/80 border-slate-100 hover:bg-white hover:border-slate-200 hover:shadow-sm'}`}
                    onClick={() => setExpandedStep(isExpanded ? -1 : i)}>
                    <div className="p-4">
                      {/* Step Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-primary-500" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                            <Bot className="w-4 h-4 text-primary-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{step.phase}</p>
                            <p className="text-xs text-slate-500">Agent: {step.actor} · {step.timestamp}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 flex items-center gap-1"><FileText className="w-3 h-3" />{step.evidenceLinks.length}条证据</span>
                          {hasCounter && <span className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{step.counterEvidence!.length}反面</span>}
                          {hasCa && <Shield className="w-4 h-4 text-trust-500" />}
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                          <p className="text-sm text-slate-700 leading-relaxed">{step.action}</p>

                          {/* Evidence Links - Enhanced with confidence bars */}
                          <div>
                            <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />正面证据链 ({step.evidenceLinks.length})
                            </p>
                            <div className="space-y-2">
                              {step.evidenceLinks.map((ev, j) => (
                                <div key={j} className="flex items-center gap-3 p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100/50">
                                  <div className="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                    <Hash className="w-3 h-3 text-emerald-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium text-slate-700">{ev.type}</span>
                                      <span className="text-[10px] text-slate-400">via {ev.source}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${ev.confidence * 100}%` }} />
                                      </div>
                                      <span className="text-[10px] font-mono text-emerald-600">{(ev.confidence * 100).toFixed(0)}%</span>
                                    </div>
                                  </div>
                                  {hasCa && <Shield className="w-3.5 h-3.5 text-trust-400 flex-shrink-0" />}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Counter Evidence - Enhanced */}
                          {hasCounter && (
                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                              <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-2">
                                <AlertTriangle className="w-3.5 h-3.5" />反面证据 / 风险信号 ({step.counterEvidence!.length})
                              </p>
                              <div className="space-y-2">
                                {step.counterEvidence!.map((ce, j) => (
                                  <div key={j} className="flex items-start gap-2 p-2 bg-white/60 rounded-lg">
                                    <div className="w-5 h-5 rounded bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                                    </div>
                                    <div>
                                      <span className="text-xs font-medium text-amber-800">{ce.type}</span>
                                      <p className="text-xs text-amber-700 mt-0.5">{ce.note}</p>
                                      <p className="text-[10px] text-amber-500 mt-0.5">来源: {ce.source}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Model & Prompt Version Info */}
                          <div className="flex items-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); setShowModelInfo(isModelExpanded ? null : i); }} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                              <Cpu className="w-3 h-3 text-slate-500" />
                              <span className="text-[10px] text-slate-600">Model: {step.modelVersion || 'N/A'}</span>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setShowModelInfo(isModelExpanded ? null : i); }} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                              <Code2 className="w-3 h-3 text-slate-500" />
                              <span className="text-[10px] text-slate-600">Prompt: {step.promptVersion || 'N/A'}</span>
                            </button>
                          </div>

                          {isModelExpanded && (
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 animate-in" onClick={e => e.stopPropagation()}>
                              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">模型与Prompt版本详情</p>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="p-2 bg-white rounded-lg">
                                  <p className="text-[10px] text-slate-400">Model Version</p>
                                  <p className="text-xs font-mono text-slate-700">{step.modelVersion || 'N/A'}</p>
                                  <p className="text-[10px] text-slate-400 mt-1">Base: Qwen2.5-72B-Instruct</p>
                                </div>
                                <div className="p-2 bg-white rounded-lg">
                                  <p className="text-[10px] text-slate-400">Prompt Version</p>
                                  <p className="text-xs font-mono text-slate-700">{step.promptVersion || 'N/A'}</p>
                                  <p className="text-[10px] text-slate-400 mt-1">Registry: prompt-registry.rongcaitong.com</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <ExternalLink className="w-3 h-3 text-primary-500" />
                                <span className="text-[10px] text-primary-600 hover:underline cursor-pointer">查看Prompt全文 →</span>
                              </div>
                            </div>
                          )}

                          {/* SM3 Hash & CA Signature */}
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Hash className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">SM3 Hash</span>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); handleCopyHash(step.sm3Hash, step.id); }} className="flex items-center gap-1 text-[10px] text-primary-600 hover:text-primary-700">
                                <Copy className="w-3 h-3" />{copiedHash === step.id ? '已复制' : '复制'}
                              </button>
                            </div>
                            <p className="text-xs font-mono text-slate-700 bg-white p-2 rounded border border-slate-100">{step.sm3Hash}</p>
                            {hasCa && (
                              <div className="flex items-center gap-2 p-2 bg-trust-50 rounded-lg border border-trust-100">
                                <Shield className="w-3.5 h-3.5 text-trust-600" />
                                <div>
                                  <p className="text-[10px] text-trust-700 font-medium">四川CA SM2数字签名</p>
                                  <p className="text-[10px] font-mono text-trust-600">{step.caSignature}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer - Enhanced */}
        <div className="p-4 border-t border-slate-100 bg-gradient-to-r from-slate-50 to-trust-50/30 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-trust-500" />
              <span className="text-xs text-slate-600">全链路SM2签名 · 不可篡改 · 四川CA存证</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded">
              <Lock className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] text-slate-500 font-mono">Chain: {decisionLineage.length} blocks</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportPdf} disabled={exportingPdf} className="btn-secondary text-xs flex items-center gap-1.5 disabled:opacity-50">
              <Download className="w-3.5 h-3.5" />{exportingPdf ? '导出中...' : '导出报告'}
            </button>
            <button onClick={handleVerify} disabled={verifying || verified} className="btn-primary text-xs disabled:opacity-50 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />{verifying ? '验证中...' : verified ? '✓ 全链路已验证' : '验证全链路签名'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
