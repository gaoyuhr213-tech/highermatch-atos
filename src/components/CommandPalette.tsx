/**
 * CommandPalette — 全局命令面板
 * PRD §7.2: ⌘K 全局搜索 + 快捷操作
 * 
 * 支持：搜索页面/候选人/决策/操作 + 键盘导航
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, LayoutDashboard, GitBranch, Network, Video,
  FileText, Users, Fingerprint, ArrowRight, Command
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CommandItem {
  id: string;
  label: string;
  category: 'navigation' | 'action' | 'candidate' | 'decision';
  icon: typeof Search;
  path?: string;
  action?: () => void;
}

const COMMANDS: CommandItem[] = [
  { id: 'nav-command', label: '决策总控台', category: 'navigation', icon: LayoutDashboard, path: '/b/command' },
  { id: 'nav-pipeline', label: '招聘流水线', category: 'navigation', icon: GitBranch, path: '/b/pipeline' },
  { id: 'nav-graph', label: '人才图谱', category: 'navigation', icon: Network, path: '/b/graph' },
  { id: 'nav-interview', label: '面试监控', category: 'navigation', icon: Video, path: '/b/interview' },
  { id: 'nav-audit', label: '审计日志', category: 'navigation', icon: FileText, path: '/b/audit' },
  { id: 'nav-community', label: '同行互助圈', category: 'navigation', icon: Users, path: '/b/community' },
  { id: 'act-lineage', label: '打开决策血统追溯', category: 'action', icon: Fingerprint },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onLineage?: () => void;
}

export function CommandPalette({ open, onClose, onLineage }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const filtered = COMMANDS.filter(cmd =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const execute = useCallback((cmd: CommandItem) => {
    if (cmd.path) navigate(cmd.path);
    if (cmd.id === 'act-lineage') onLineage?.();
    onClose();
  }, [navigate, onClose, onLineage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && filtered[selectedIdx]) { execute(filtered[selectedIdx]); }
    if (e.key === 'Escape') onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-ink-950/30 backdrop-blur-sm flex items-start justify-center pt-[20vh] z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-lg bg-surface rounded-2xl shadow-e4 border border-border overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* 搜索输入 */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="w-5 h-5 text-muted" />
              <input aria-label="搜索命令"
                ref={inputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
                onKeyDown={handleKeyDown}
                placeholder="搜索页面、候选人、决策..."
                className="flex-1 text-sm text-foreground placeholder:text-muted outline-none bg-transparent"
              />
              <kbd className="text-[10px] px-1.5 py-0.5 bg-ink-50 border border-border rounded font-mono text-muted">ESC</kbd>
            </div>

            {/* 结果列表 */}
            <div className="max-h-72 overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">无匹配结果</p>
              ) : (
                filtered.map((cmd, idx) => (
                  <button
                    key={cmd.id}
                    onClick={() => execute(cmd)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      idx === selectedIdx ? 'bg-brand-50 text-brand-700' : 'text-foreground hover:bg-ink-50'
                    }`}
                  >
                    <cmd.icon className="w-4 h-4 opacity-60" />
                    <span className="flex-1 text-left font-medium">{cmd.label}</span>
                    <span className="text-[10px] text-muted uppercase">{cmd.category === 'navigation' ? '页面' : '操作'}</span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-40" />
                  </button>
                ))
              )}
            </div>

            {/* 底部提示 */}
            <div className="px-4 py-2.5 border-t border-border bg-ink-50/50 flex items-center gap-4 text-[10px] text-muted">
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-surface border border-border rounded font-mono">↑↓</kbd> 导航</span>
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-surface border border-border rounded font-mono">↵</kbd> 执行</span>
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-surface border border-border rounded font-mono">esc</kbd> 关闭</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
