import React from 'react';

interface DividerProps {
  label?: string;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export const Divider: React.FC<DividerProps> = ({
  label,
  orientation = 'horizontal',
  className = '',
}) => {
  if (orientation === 'vertical') {
    return <div className={`w-px bg-ink-200 self-stretch ${className}`} />;
  }

  if (label) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="flex-1 h-px bg-ink-200" />
        <span className="text-xs text-muted font-medium whitespace-nowrap">{label}</span>
        <div className="flex-1 h-px bg-ink-200" />
      </div>
    );
  }

  return <div className={`w-full h-px bg-ink-200 ${className}`} />;
};
