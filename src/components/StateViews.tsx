export function LoadingView({ text = '加载中...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}

export function EmptyView({ title = '暂无数据', description = '' }: { title?: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <h3 className="text-base font-medium text-slate-700 dark:text-slate-300">{title}</h3>
      {description && <p className="text-sm text-slate-500">{description}</p>}
    </div>
  );
}

export function ErrorView({ message = '加载失败', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">重试</button>
      )}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="animate-pulse bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-4" />
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full mb-2" />
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-5/6 mb-2" />
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse">
      <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded mb-1" />
      ))}
    </div>
  );
}
