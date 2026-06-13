import React, { useState, useRef, useEffect } from 'react';

interface DropdownItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

interface DropdownProps {
  items: DropdownItem[];
  onSelect: (key: string) => void;
  trigger: React.ReactNode;
  placement?: 'bottom-start' | 'bottom-end';
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  items,
  onSelect,
  trigger,
  placement = 'bottom-end',
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const posClass = placement === 'bottom-start' ? 'left-0' : 'right-0';

  return (
    <div ref={ref} className={`relative inline-flex ${className}`}>
      <div onClick={() => setOpen(!open)} className="cursor-pointer">
        {trigger}
      </div>
      {open && (
        <div className={`absolute z-50 top-full mt-1 ${posClass} min-w-[180px] bg-surface border border-border rounded-xl shadow-elevated overflow-hidden animate-[fadeIn_100ms_ease-out]`}>
          <div className="p-1">
            {items.map((item) => {
              if (item.divider) return <div key={item.key} className="my-1 border-t border-border" />;
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => { onSelect(item.key); setOpen(false); }}
                  className={[
                    'w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg text-left transition-colors',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                    item.danger ? 'text-error-500 hover:bg-error-50' : 'text-foreground hover:bg-ink-50',
                  ].join(' ')}
                >
                  {item.icon && <span className="shrink-0 w-4 h-4">{item.icon}</span>}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
