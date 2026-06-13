import React from 'react';

type TagColor = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'trust';

interface TagProps {
  color?: TagColor;
  closable?: boolean;
  onClose?: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const colorStyles: Record<TagColor, string> = {
  default: 'bg-ink-100 text-muted border-border',
  primary: 'bg-brand-50 text-brand-700 border-brand-200',
  success: 'bg-success-50 text-green-700 border-green-200',
  warning: 'bg-warning-50 text-amber-700 border-amber-200',
  error: 'bg-error-50 text-red-700 border-red-200',
  trust: 'bg-trust-50 text-emerald-700 border-emerald-200',
};

export const Tag: React.FC<TagProps> = ({
  color = 'default',
  closable = false,
  onClose,
  icon,
  children,
  className = '',
}) => {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border rounded-md ${colorStyles[color]} ${className}`}>
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
      {closable && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose?.(); }}
          className="ml-0.5 p-0.5 rounded hover:bg-black/5 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
};
