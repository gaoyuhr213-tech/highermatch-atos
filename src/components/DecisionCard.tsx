/**
 * DecisionCard — 决策卡片
 * PRD §7.1: 决策总控台核心组件
 * 
 * 展示：决策类型、状态、签名主体/操作人、风险等级、时间线
 * 支持：点击展开血统追溯
 */

import { Shield, Clock, AlertTriangle, CheckCircle2, ChevronRight, User } from 'lucide-react';
import { motion } from 'framer-motion';

export interface DecisionCardData {
  id: string;
  title: string;
  type: 'offer' | 'promotion' | 'termination' | 'transfer' | 'budget';
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  signer: string;
  operator: string;
  certLevel: 'EV' | 'OV' | 'DV';
  createdAt: string;
  dueAt?: string;
  summary: string;
}

const TYPE_LABELS: Record<DecisionCardData['type'], string> = {
  offer: 'Offer审批',
  promotion: '晋升决策',
  termination: '离职审批',
  transfer: '调岗决策',
  budget: '预算审批',
};

const STATUS_STYLES: Record<DecisionCardData['status'], { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-warn-50', text: 'text-warn-700', label: '待审批' },
  approved: { bg: 'bg-trust-50', text: 'text-trust-700', label: '已通过' },
  rejected: { bg: 'bg-risk-50', text: 'text-risk-700', label: '已驳回' },
  expired: { bg: 'bg-ink-100', text: 'text-muted', label: '已过期' },
};

const RISK_STYLES: Record<DecisionCardData['riskLevel'], { color: string; label: string }> = {
  low: { color: 'text-trust-600', label: '低风险' },
  medium: { color: 'text-warn-600', label: '中风险' },
  high: { color: 'text-risk-500', label: '高风险' },
  critical: { color: 'text-risk-700', label: '极高风险' },
};

interface Props {
  data: DecisionCardData;
  onViewLineage?: (id: string) => void;
  onClick?: () => void;
}

export function DecisionCard({ data, onViewLineage, onClick }: Props) {
  const statusStyle = STATUS_STYLES[data.status];
  const riskStyle = RISK_STYLES[data.riskLevel];

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      className="bg-surface rounded-2xl border border-border p-4 cursor-pointer transition-colors hover:border-brand-200/60"
    >
      {/* 头部 */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted uppercase">{TYPE_LABELS[data.type]}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusStyle.bg} ${statusStyle.text}`}>
              {statusStyle.label}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-foreground leading-tight">{data.title}</h3>
        </div>
        {data.riskLevel !== 'low' && (
          <div className={`flex items-center gap-1 ${riskStyle.color}`}>
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium">{riskStyle.label}</span>
          </div>
        )}
      </div>

      {/* 摘要 */}
      <p className="text-xs text-muted mb-3 line-clamp-2">{data.summary}</p>

      {/* 签名主体/操作人 */}
      <div className="flex items-center gap-3 mb-3 text-[10px]">
        <div className="flex items-center gap-1 text-muted">
          <Shield className="w-3 h-3 text-seal-ev" />
          <span>{data.signer}</span>
          <span className="px-1 py-0.5 bg-seal-ev/10 text-seal-ev rounded font-bold text-[8px]">{data.certLevel}</span>
        </div>
        <div className="w-px h-3 bg-ink-200" />
        <div className="flex items-center gap-1 text-muted">
          <User className="w-3 h-3" />
          <span>{data.operator}</span>
        </div>
      </div>

      {/* 底部 */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="flex items-center gap-1.5 text-[10px] text-muted">
          <Clock className="w-3 h-3" />
          <span>{data.createdAt}</span>
          {data.dueAt && <span className="text-warn-600">· 截止 {data.dueAt}</span>}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onViewLineage?.(data.id); }}
          className="flex items-center gap-0.5 text-[10px] text-brand-600 hover:text-brand-700 font-medium"
        >
          血统追溯 <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  );
}
