import React, { useState, useMemo, useCallback } from 'react';

export interface Column<T> {
  key: string;
  title: string;
  width?: string;
  sortable?: boolean;
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  rowKey?: string;
  selectable?: boolean;
  onSelectionChange?: (selectedKeys: string[]) => void;
  pagination?: { page: number; pageSize: number; total: number; onChange: (page: number) => void };
  loading?: boolean;
  emptyText?: string;
  onRowClick?: (row: T) => void;
  className?: string;
  batchActions?: React.ReactNode;
}

type SortDir = 'asc' | 'desc' | null;

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey = 'id',
  selectable = false,
  onSelectionChange,
  pagination,
  loading = false,
  emptyText = '暂无数据',
  onRowClick,
  className = '',
  batchActions,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDir) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const handleSort = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev !== key) { setSortDir('asc'); return key; }
      setSortDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'));
      return key;
    });
  }, []);

  const toggleRow = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      onSelectionChange?.(Array.from(next));
      return next;
    });
  }, [onSelectionChange]);

  const toggleAll = useCallback(() => {
    if (selectedKeys.size === data.length) {
      setSelectedKeys(new Set());
      onSelectionChange?.([]);
    } else {
      const all = new Set(data.map((r) => String(r[rowKey])));
      setSelectedKeys(all);
      onSelectionChange?.(Array.from(all));
    }
  }, [data, rowKey, selectedKeys.size, onSelectionChange]);

  const allSelected = data.length > 0 && selectedKeys.size === data.length;
  const someSelected = selectedKeys.size > 0 && !allSelected;

  return (
    <div className={`w-full overflow-hidden border border-border rounded-xl bg-surface ${className}`}>
      {/* Batch Actions Bar */}
      {selectable && selectedKeys.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-brand-50 border-b border-brand-100">
          <span className="text-sm font-medium text-brand-700">已选 {selectedKeys.size} 项</span>
          {batchActions}
          <button onClick={() => { setSelectedKeys(new Set()); onSelectionChange?.([]); }} className="ml-auto text-xs text-muted hover:text-foreground">取消选择</button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-ink-25">
              {selectable && (
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500/20"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={[
                    'px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider',
                    col.sortable ? 'cursor-pointer select-none hover:text-foreground' : '',
                  ].join(' ')}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.title}
                    {col.sortable && sortKey === col.key && sortDir && (
                      <svg className={`w-3.5 h-3.5 ${sortDir === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                      </svg>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-ink-50">
                  {selectable && <td className="px-3 py-3"><div className="w-4 h-4 bg-ink-100 rounded animate-pulse" /></td>}
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3"><div className="h-4 bg-ink-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} /></td>
                  ))}
                </tr>
              ))
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-12 text-center text-muted">{emptyText}</td>
              </tr>
            ) : (
              sortedData.map((row, idx) => {
                const key = String(row[rowKey]);
                const isSelected = selectedKeys.has(key);
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(row)}
                    className={[
                      'border-b border-ink-50 transition-colors',
                      onRowClick ? 'cursor-pointer' : '',
                      isSelected ? 'bg-brand-50/50' : 'hover:bg-ink-50',
                    ].join(' ')}
                  >
                    {selectable && (
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(key)}
                          className="w-4 h-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500/20"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-foreground">
                        {col.render ? col.render(row[col.key], row, idx) : String(row[col.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <span className="text-xs text-muted">
            共 {pagination.total} 条，第 {pagination.page}/{Math.ceil(pagination.total / pagination.pageSize)} 页
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={pagination.page <= 1}
              onClick={() => pagination.onChange(pagination.page - 1)}
              className="px-2.5 py-1.5 text-xs text-muted hover:bg-ink-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              上一页
            </button>
            <button
              disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
              onClick={() => pagination.onChange(pagination.page + 1)}
              className="px-2.5 py-1.5 text-xs text-muted hover:bg-ink-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
