/**
 * LineageGraph — 决策血统图（简化版）
 * PRD §7.1: 决策血统追溯可视化
 * 
 * 展示：证据→反向证据→模型→Prompt版本→签名主体→操作人
 * 标注：【Mock】血统数据为模拟
 */

import { Shield, Brain, FileText, User, GitBranch, Hash } from 'lucide-react';

export interface LineageNode {
  id: string;
  type: 'evidence' | 'counter_evidence' | 'model' | 'prompt' | 'signer' | 'operator';
  label: string;
  detail: string;
  timestamp?: string;
}

interface Props {
  nodes: LineageNode[];
  title?: string;
}

const NODE_ICONS = {
  evidence: FileText,
  counter_evidence: GitBranch,
  model: Brain,
  prompt: Hash,
  signer: Shield,
  operator: User,
};

const NODE_STYLES = {
  evidence: 'border-trust-200 bg-trust-50',
  counter_evidence: 'border-risk-200 bg-risk-50',
  model: 'border-brand-200 bg-brand-50',
  prompt: 'border-border bg-ink-50',
  signer: 'border-seal-ev/30 bg-seal-ev/5',
  operator: 'border-border bg-ink-50',
};

const NODE_ICON_COLORS = {
  evidence: 'text-trust-600',
  counter_evidence: 'text-risk-600',
  model: 'text-brand-600',
  prompt: 'text-muted',
  signer: 'text-seal-ev',
  operator: 'text-muted',
};

export function LineageGraph({ nodes, title }: Props) {
  return (
    <div className="space-y-1">
      {title && (
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">{title}</p>
      )}
      <div className="relative pl-6">
        {/* 竖线 */}
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-ink-200" />
        
        {nodes.map((node, idx) => {
          const Icon = NODE_ICONS[node.type];
          const style = NODE_STYLES[node.type];
          const iconColor = NODE_ICON_COLORS[node.type];
          return (
            <div key={node.id} className="relative flex items-start gap-3 pb-3">
              {/* 节点圆点 */}
              <div className={`absolute left-[-13px] w-[22px] h-[22px] rounded-full border-2 ${style} flex items-center justify-center z-10`}>
                <Icon className={`w-3 h-3 ${iconColor}`} />
              </div>
              {/* 内容 */}
              <div className={`flex-1 px-3 py-2 rounded-xl border ${style}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">{node.label}</span>
                  {node.timestamp && (
                    <span className="text-[9px] text-muted font-mono tabular-nums">{node.timestamp}</span>
                  )}
                </div>
                <p className="text-[10px] text-muted mt-0.5">{node.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted text-right">【Mock】血统数据为演示</p>
    </div>
  );
}
