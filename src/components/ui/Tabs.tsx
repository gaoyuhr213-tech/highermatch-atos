import React, { useState } from 'react';

interface TabItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
  disabled?: boolean;
  content?: React.ReactNode;
}

interface TabsProps {
  items: TabItem[];
  activeKey?: string;
  onChange?: (key: string) => void;
  variant?: 'line' | 'pill' | 'enclosed';
  size?: 'sm' | 'md';
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  activeKey,
  onChange,
  variant = 'line',
  size = 'md',
  className = '',
}) => {
  const [internalKey, setInternalKey] = useState(items[0]?.key ?? '');
  const currentKey = activeKey ?? internalKey;

  const handleChange = (key: string) => {
    setInternalKey(key);
    onChange?.(key);
  };

  const sizeClass = size === 'sm' ? 'text-xs' : 'text-sm';

  const getTabClass = (key: string, disabled?: boolean) => {
    const isActive = key === currentKey;
    const base = `inline-flex items-center gap-1.5 font-medium transition-all duration-150 whitespace-nowrap ${sizeClass}`;
    const disabledClass = disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer';

    if (variant === 'line') {
      return `${base} ${disabledClass} px-1 pb-2.5 border-b-2 ${
        isActive
          ? 'text-brand-600 border-brand-500'
          : 'text-muted border-transparent hover:text-foreground hover:border-ink-300'
      }`;
    }
    if (variant === 'pill') {
      return `${base} ${disabledClass} px-3 py-1.5 rounded-lg ${
        isActive
          ? 'bg-brand-500 text-white shadow-sm'
          : 'text-muted hover:bg-ink-100'
      }`;
    }
    // enclosed
    return `${base} ${disabledClass} px-4 py-2 rounded-t-lg border border-b-0 ${
      isActive
        ? 'bg-surface text-brand-600 border-border -mb-px'
        : 'text-muted border-transparent hover:text-foreground'
    }`;
  };

  const activeItem = items.find((i) => i.key === currentKey);

  return (
    <div className={className}>
      <div className={`flex gap-1 ${variant === 'line' ? 'border-b border-border' : ''} ${variant === 'enclosed' ? 'border-b border-border' : ''}`}>
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            disabled={item.disabled}
            onClick={() => !item.disabled && handleChange(item.key)}
            className={getTabClass(item.key, item.disabled)}
          >
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            <span>{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-ink-200 text-muted rounded-full">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      {activeItem?.content && <div className="pt-4">{activeItem.content}</div>}
    </div>
  );
};
