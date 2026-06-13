/**
 * Skeleton — 骨架屏加载组件
 * PRD §10: Loading状态
 */

import { cn } from '../lib/utils';

interface Props {
  className?: string;
  /** 圆形 */
  circle?: boolean;
}

function cn_(...inputs: (string | undefined | false)[]) {
  return inputs.filter(Boolean).join(' ');
}

export function Skeleton({ className, circle }: Props) {
  return (
    <div
      className={cn_(
        'animate-pulse bg-ink-100 rounded-lg',
        circle && 'rounded-full',
        className
      )}
    />
  );
}

/** 预设：卡片骨架 */
export function SkeletonCard() {
  return (
    <div className="p-4 rounded-2xl border border-border space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton circle className="w-10 h-10" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

/** 预设：表格骨架 */
export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-4 px-4 py-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 flex-1" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-t border-border/30">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}
