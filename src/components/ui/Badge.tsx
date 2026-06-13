import React from 'react';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'trust';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  count?: number;
  maxCount?: number;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-ink-100 text-muted border-border',
  primary: 'bg-brand-50 text-brand-700 border-brand-200',
  success: 'bg-success-50 text-green-700 border-green-200',
  warning: 'bg-warning-50 text-amber-700 border-amber-200',
  error: 'bg-error-50 text-red-700 border-red-200',
  trust: 'bg-trust-50 text-emerald-700 border-emerald-200',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-ink-400',
  primary: 'bg-brand-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  error: 'bg-error-500',
  trust: 'bg-trust-500',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-2.5 py-1 text-sm',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  dot = false,
  count,
  maxCount = 99,
  icon,
  children,
  className = '',
}) => {
  const displayCount = count !== undefined ? (count > maxCount ? `${maxCount}+` : String(count)) : null;

  return (
    <span
      className={[
        'inline-flex items-center gap-1 font-medium border rounded-full whitespace-nowrap',
        variantStyles[variant],
        sizeStyles[size],
        className,
      ].join(' ')}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {icon && <span className="shrink-0">{icon}</span>}
      {displayCount ?? children}
    </span>
  );
};
