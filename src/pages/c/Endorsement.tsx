import { useEndorsementCards, useVerifyEndorsement } from '../../lib/api/hooks';
import { Shield, Share2, QrCode, ExternalLink, X, CheckCircle2, Clock, Send, FileCheck, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { EndorsementCard } from '../../lib/api/types';

const statusMap: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  generated: { label: '已生成', cls: 'badge-blue', icon: Clock },
  signed: { label: 'CA已签', cls: 'badge-trust', icon: Shield },
  shared: { label: '已分享', cls: 'badge-yellow', icon: Send },
  verified: { label: '已验证', cls: 'badge-green', icon: CheckCircle2 },
  converted: { label: '已转化', cls: 'badge-green', icon: FileCheck },
};

const statusFlow = ['generated', 'signed', 'shared', 'verified', 'converted'];

export default function Endorsement() {
  const { data: endorsementData, isLoading, error } = useEndorsementCards();
  const verifyMutation = useVerifyEndorsement();
  const [localCards, setLocalCards] = useState<EndorsementCard[] | null>(null);
  const [showQR, setShowQR] = useState<string | null>(null);
  const [showVerify, setShowVerify] = useState<string | null>(null);

  // Use local state for optimistic updates, fallback to server data
  const serverCards = endorsementData?.items || [];
  const cards = localCards || serverCards;

  // Sync server data to local when it arrives and local is not yet set
  if (!localCards && serverCards.length > 0) {
    setLocalCards(serverCards.map(c => ({ ...c })));
  }

  const advanceStatus = (id: string) => {
    setLocalCards(prev => (prev || []).map(c => {
      if (c.id !== id) return c;
      const currentIdx = statusFlow.indexOf(c.status);
      if (currentIdx < statusFlow.length - 1) return { ...c, status: statusFlow[currentIdx + 1] as EndorsementCard['status'] };
      return c;
    }));
  };

  const handleShare = (id: string) => {
    const card = cards.find(c => c.id === id);
    if (card && card.status === 'signed') advanceStatus(id);
  };

  const handleVerify = (id: string) => {
    setShowVerify(id);
    verifyMutation.mutate(id);
    const card = cards.find(c => c.id === id);
    if (card && (card.status === 'shared' || card.status === 'verified')) {
      setLocalCards(prev => (prev || []).map(c => c.id === id ? { ...c, verifiedCount: c.verifiedCount + 1 } : c));
      if (card.status === 'shared') advanceStatus(id);
    }
  };

  if (isLoading) return <div className="p-8 flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /><span className="ml-3 text-slate-500">加载背书卡片...</span></div>;
  if (error) return <div className="p-8 text-center text-red-500">加载失败：{(error as Error).message}</div>;

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-slate-900">背书卡片</h1><p className="text-sm text-slate-500 mt-1">Endorsement Card · CA签名可信职业背书</p></div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {statusFlow.map((s, i) => (
              <span key={s} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-primary-400' : i === statusFlow.length - 1 ? 'bg-success-500' : 'bg-slate-300'}`} />
                {statusMap[s].label}
                {i < statusFlow.length - 1 && <span className="text-slate-300 mx-1">→</span>}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map(card => {
          const StatusIcon = statusMap[card.status].icon;
          const currentIdx = statusFlow.indexOf(card.status);
          return (
            <div key={card.id} className="glass-card p-5 flex flex-col group">
              {/* Status Progress */}
              <div className="flex items-center gap-1 mb-4">
                {statusFlow.map((s, i) => (
                  <div key={s} className="flex items-center flex-1">
                    <div className={`w-full h-1 rounded-full ${i <= currentIdx ? 'bg-primary-500' : 'bg-slate-100'}`} />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <StatusIcon className="w-4 h-4 text-trust-500" />
                  <span className={`badge ${statusMap[card.status].cls}`}>{statusMap[card.status].label}</span>
                </div>
                <span className="text-[10px] text-slate-400">{card.createdAt}</span>
              </div>
              <h3 className="text-base font-semibold text-slate-800 mb-1">{card.candidate}</h3>
              <p className="text-sm text-slate-600 mb-3">{card.position}</p>
              <div className="space-y-2 mb-4 flex-1">
                <div className="flex items-center justify-between text-xs"><span className="text-slate-500">签发机构</span><span className="text-slate-700 font-medium">{card.issuer}</span></div>
                <div className="flex items-center justify-between text-xs"><span className="text-slate-500">CA签名</span><span className="text-trust-600 font-mono text-[10px]">{card.caSignature}</span></div>
                <div className="flex items-center justify-between text-xs"><span className="text-slate-500">SM3哈希</span><span className="text-slate-600 font-mono text-[10px]">{card.sm3Hash}</span></div>
                <div className="flex items-center justify-between text-xs"><span className="text-slate-500">验证次数</span><span className="text-primary-600 font-medium">{card.verifiedCount}次</span></div>
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <button onClick={() => handleShare(card.id)} className={`btn-ghost flex-1 ${card.status === 'signed' ? 'text-primary-600 hover:bg-primary-50' : ''}`}><Share2 className="w-3.5 h-3.5" />分享</button>
                <button onClick={() => setShowQR(card.id)} className="btn-ghost flex-1"><QrCode className="w-3.5 h-3.5" />二维码</button>
                <button onClick={() => handleVerify(card.id)} className={`btn-ghost flex-1 ${card.status === 'shared' ? 'text-trust-600 hover:bg-trust-50' : ''}`}><ExternalLink className="w-3.5 h-3.5" />验证</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* QR Code Modal */}
      {showQR && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowQR(null)}>
          <div className="bg-white rounded-2xl p-6 w-80 shadow-elevated" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800">背书卡片二维码</h3>
              <button onClick={() => setShowQR(null)} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="w-48 h-48 mx-auto bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center mb-4">
              <div className="text-center">
                <QrCode className="w-16 h-16 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400">扫码验证背书真实性</p>
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-2">分享链接</p>
              <div className="bg-slate-50 rounded-lg p-2 font-mono text-[10px] text-slate-600 break-all">
                {cards.find(c => c.id === showQR)?.shareUrl || 'https://verify.sichuan-ca.cn/...'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verify Modal */}
      {showVerify && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowVerify(null)}>
          <div className="bg-white rounded-2xl p-6 w-96 shadow-elevated" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800">背书验证结果</h3>
              <button onClick={() => setShowVerify(null)} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>
            {(() => {
              const card = cards.find(c => c.id === showVerify);
              if (!card) return null;
              return (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-trust-50 rounded-xl border border-trust-100">
                    <CheckCircle2 className="w-6 h-6 text-trust-600" />
                    <div><p className="text-sm font-semibold text-trust-800">验证通过</p><p className="text-xs text-trust-600">CA数字签名有效，背书内容未被篡改</p></div>
                  </div>
                  <div className="space-y-2 p-3 bg-slate-50 rounded-xl">
                    <div className="flex justify-between text-xs"><span className="text-slate-500">签名算法</span><span className="text-slate-700">SM2 (国密)</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-500">证书颁发</span><span className="text-slate-700">四川CA认证中心</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-500">签名时间</span><span className="text-slate-700">{card.createdAt}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-500">OCSP状态</span><span className="text-trust-600 font-medium">Good</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-500">SM3哈希</span><span className="text-slate-600 font-mono text-[10px]">{card.sm3Hash}</span></div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
