/**
 * SSEFeed — 实时事件流组件
 * PRD §7.2: 决策总控台SSE事件流
 * 
 * 模拟Server-Sent Events推送，展示实时决策/审批/AI事件
 * 标注：【Mock】事件流为本地模拟，非真实SSE连接
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Shield, AlertTriangle, CheckCircle2, Clock,
  User, Brain, FileCheck, Activity
} from 'lucide-react';

export interface SSEEvent {
  id: string;
  type: 'decision' | 'approval' | 'ai_insight' | 'risk_alert' | 'system';
  title: string;
  detail: string;
  timestamp: string;
  actor?: string;
  severity?: 'info' | 'success' | 'warning' | 'critical';
}

const EVENT_ICONS = {
  decision: FileCheck,
  approval: CheckCircle2,
  ai_insight: Brain,
  risk_alert: AlertTriangle,
  system: Activity,
};

const SEVERITY_STYLES = {
  info: 'bg-brand-50 border-brand-100 text-brand-700',
  success: 'bg-trust-50 border-trust-100 text-trust-700',
  warning: 'bg-warn-50 border-warn-100 text-warn-700',
  critical: 'bg-risk-50 border-risk-100 text-risk-700',
};

/** Mock事件池 */
const MOCK_EVENTS: Omit<SSEEvent, 'id' | 'timestamp'>[] = [
  { type: 'decision', title: '决策提案已提交', detail: '高级算法工程师 Offer审批 → 待CFO签名', actor: '张某·HR总监', severity: 'info' },
  { type: 'ai_insight', title: 'AI风险预警', detail: '候选人赵晓峰竞业协议存在潜在冲突', severity: 'warning' },
  { type: 'approval', title: '签名完成', detail: 'SM2签名已确认 · 蜀道集团EV证书', actor: '蜀道集团·企业U盾', severity: 'success' },
  { type: 'risk_alert', title: '异常检测', detail: '候选人简历学历信息与学信网不一致', severity: 'critical' },
  { type: 'system', title: '模型更新', detail: 'STAR评估模型v2.3已部署，准确率+3.2%', severity: 'info' },
  { type: 'decision', title: '批量审批完成', detail: '3份背书卡已签发 · 区块链存证确认', actor: '系统自动', severity: 'success' },
  { type: 'ai_insight', title: '人才洞察', detail: '本周AI寻访命中率较上周提升12%', severity: 'info' },
];

interface Props {
  /** 最大显示事件数 */
  maxEvents?: number;
  /** 事件推送间隔(ms) */
  interval?: number;
  /** 是否暂停 */
  paused?: boolean;
  /** 紧凑模式 */
  compact?: boolean;
}

export function SSEFeed({ maxEvents = 8, interval = 4000, paused = false, compact = false }: Props) {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const indexRef = useRef(0);

  const pushEvent = useCallback(() => {
    const template = MOCK_EVENTS[indexRef.current % MOCK_EVENTS.length];
    const newEvent: SSEEvent = {
      ...template,
      id: `sse-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setEvents(prev => [newEvent, ...prev].slice(0, maxEvents));
    indexRef.current++;
  }, [maxEvents]);

  useEffect(() => {
    if (paused) return;
    // 初始推2条
    pushEvent();
    setTimeout(pushEvent, 800);
    const timer = setInterval(pushEvent, interval);
    return () => clearInterval(timer);
  }, [paused, interval, pushEvent]);

  return (
    <div className={`flex flex-col ${compact ? 'gap-1.5' : 'gap-2'}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-brand-500" />
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">实时事件流</span>
          <span className="text-[10px] text-muted">【Mock】</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-trust-500 animate-pulse" />
          <span className="text-[10px] text-muted">Live</span>
        </div>
      </div>

      {/* 事件列表 */}
      <div className={`space-y-1.5 overflow-y-auto ${compact ? 'max-h-48' : 'max-h-80'}`}>
        <AnimatePresence initial={false}>
          {events.map(event => {
            const Icon = EVENT_ICONS[event.type];
            const style = SEVERITY_STYLES[event.severity || 'info'];
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -12, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, x: 12, height: 0 }}
                transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                className={`flex items-start gap-2.5 px-3 py-2 rounded-xl border ${style}`}
              >
                <Icon className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-70" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-tight truncate">{event.title}</p>
                  <p className="text-[10px] opacity-70 truncate">{event.detail}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-[10px] opacity-60 font-mono tabular-nums">{event.timestamp}</span>
                  {event.actor && (
                    <p className="text-[10px] opacity-50 flex items-center gap-0.5 justify-end">
                      <User className="w-2.5 h-2.5" />{event.actor.split('·')[0]}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
