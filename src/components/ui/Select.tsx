import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

interface SelectProps {
  options: SelectOption[];
  value?: string | string[];
  onChange?: (value: string | string[]) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  multiple?: boolean;
  searchable?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
}

const sizeStyles = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-9 px-3.5 text-sm',
  lg: 'h-11 px-4 text-base',
};

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder = '请选择...',
  label,
  error,
  multiple = false,
  searchable = false,
  disabled = false,
  size = 'md',
  fullWidth = true,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedValues = Array.isArray(value) ? value : value ? [value] : [];

  const filteredOptions = searchable
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const handleSelect = useCallback(
    (optValue: string) => {
      if (multiple) {
        const next = selectedValues.includes(optValue)
          ? selectedValues.filter((v) => v !== optValue)
          : [...selectedValues, optValue];
        onChange?.(next);
      } else {
        onChange?.(optValue);
        setOpen(false);
        setSearch('');
      }
    },
    [multiple, selectedValues, onChange]
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setSearch('');
      }
    };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const displayLabel = selectedValues.length
    ? selectedValues.map((v) => options.find((o) => o.value === v)?.label).filter(Boolean).join(', ')
    : '';

  return (
    <div ref={containerRef} className={`relative flex flex-col gap-1.5 ${fullWidth ? 'w-full' : ''}`}>
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={[
          'flex items-center justify-between border bg-surface text-left rounded-lg',
          'transition-all duration-150 ease-out',
          'focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error ? 'border-error-500' : open ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-border hover:border-ink-300',
          sizeStyles[size],
          className,
        ].join(' ')}
      >
        <span className={displayLabel ? 'text-foreground truncate' : 'text-muted truncate'}>
          {displayLabel || placeholder}
        </span>
        <svg className={`w-4 h-4 text-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-elevated max-h-60 overflow-auto">
          {searchable && (
            <div className="p-2 border-b border-border">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索..."
                className="w-full h-8 px-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
          )}
          <div className="p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted text-center">无匹配结果</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedValues.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt.value)}
                    className={[
                      'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-left transition-colors',
                      'disabled:opacity-40 disabled:cursor-not-allowed',
                      isSelected ? 'bg-brand-50 text-brand-700 font-medium' : 'text-foreground hover:bg-ink-50',
                    ].join(' ')}
                  >
                    {multiple && (
                      <span className={`w-4 h-4 border rounded flex items-center justify-center shrink-0 ${isSelected ? 'bg-brand-500 border-brand-500' : 'border-ink-300'}`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                    )}
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    <span className="truncate">{opt.label}</span>
                    {!multiple && isSelected && (
                      <svg className="w-4 h-4 text-brand-500 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
      {error && <p className="text-xs text-error-500">{error}</p>}
    </div>
  );
};
