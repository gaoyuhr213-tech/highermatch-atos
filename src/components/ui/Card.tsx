import React from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  hoverable?: boolean;
  bordered?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  icon,
  actions,
  children,
  hoverable = false,
  bordered = true,
  padding = 'md',
  className = '',
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={[
        'bg-white rounded-xl overflow-hidden transition-all duration-200',
        bordered ? 'border border-slate-200' : '',
        hoverable ? 'hover:shadow-card-hover hover:border-slate-300 cursor-pointer' : 'shadow-card',
        onClick ? 'cursor-pointer' : '',
        className,
      ].join(' ')}
    >
      {(title || actions) && (
        <div className={`flex items-center justify-between ${padding === 'none' ? 'px-5 pt-5' : `px-${padding === 'sm' ? '4' : padding === 'lg' ? '6' : '5'} pt-${padding === 'sm' ? '4' : padding === 'lg' ? '6' : '5'}`}`}>
          <div className="flex items-center gap-3">
            {icon && <span className="text-slate-400">{icon}</span>}
            <div>
              {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
              {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={paddingStyles[padding]}>{children}</div>
    </div>
  );
};
