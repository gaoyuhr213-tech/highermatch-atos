/**
 * EmptyState — 通用空状态组件
 * PRD §10: 所有页面补齐 Empty/Loading/Error 三态
 */

import { Inbox } from 'lucide-react';

interface Props {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  title = '暂无数据',
  description = '当前没有可展示的内容',
  action,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-14 h-14 rounded-2xl bg-ink-50 flex items-center justify-center mb-4">
        {icon || <Inbox className="w-6 h-6 text-muted" />}
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted text-center max-w-xs">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
