/**
 * 工具函数集
 */

/** 合并className（简化版，无需clsx依赖） */
export function cn(...inputs: (string | undefined | false | null)[]): string {
  return inputs.filter(Boolean).join(' ');
}

/** 格式化日期 */
export function formatDate(date: string | Date, format: 'short' | 'full' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (format === 'short') return d.toLocaleDateString('zh-CN');
  return d.toLocaleString('zh-CN');
}

/** 截断文本 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/** 生成随机ID */
export function randomId(prefix = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
