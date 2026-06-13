/**
 * KPICard — KPI指标卡片
 * PRD §7.2: 决策总控台KPI网格
 * 
 * tabular-nums数字 · 趋势箭头 · 语义色
 */

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  /** 语义色 */
  semantic?: 'trust' | 'risk' | 'warn' | 'neutral';
}

const SEMANTIC_STYLES = {
  trust: { value: 'text-trust-700', trend: 'text-trust-600', bg: 'bg-trust-50' },
  risk: { value: 'text-risk-700', trend: 'text-risk-600', bg: 'bg-risk-50' },
  warn: { value: 'text-warn-700', trend: 'text-warn-600', bg: 'bg-warn-50' },
  neutral: { value: 'text-foreground', trend: 'text-muted', bg: 'bg-ink-50' },
};

export function KPICard({ label, value, unit, trend, trendValue, semantic = 'neutral' }: Props) {
  const style = SEMANTIC_STYLES[semantic];
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <div className={`p-4 rounded-2xl border border-border ${style.bg} transition-all hover:shadow-e2`}>
      <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-bold tabular-nums ${style.value}`}>{value}</span>
        {unit && <span className="text-xs text-muted">{unit}</span>}
      </div>
      {trend && trendValue && (
        <div className={`flex items-center gap-1 mt-1.5 ${style.trend}`}>
          <TrendIcon className="w-3 h-3" />
          <span className="text-[10px] font-medium tabular-nums">{trendValue}</span>
        </div>
      )}
    </div>
  );
}
