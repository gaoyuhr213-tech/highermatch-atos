import React from 'react';

type ProgressVariant = 'linear' | 'circular' | 'steps';
type ProgressColor = 'primary' | 'success' | 'warning' | 'error';

interface ProgressProps {
  value: number;
  max?: number;
  variant?: ProgressVariant;
  color?: ProgressColor;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
  steps?: number;
  currentStep?: number;
  className?: string;
}

const colorStyles: Record<ProgressColor, string> = {
  primary: 'bg-brand-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  error: 'bg-error-500',
};

const trackSizes = { sm: 'h-1', md: 'h-2', lg: 'h-3' };

export const Progress: React.FC<ProgressProps> = ({
  value,
  max = 100,
  variant = 'linear',
  color = 'primary',
  size = 'md',
  showLabel = false,
  label,
  steps = 4,
  currentStep = 0,
  className = '',
}) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  if (variant === 'circular') {
    const circleSize = size === 'sm' ? 40 : size === 'lg' ? 80 : 60;
    const strokeWidth = size === 'sm' ? 3 : size === 'lg' ? 6 : 4;
    const radius = (circleSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (pct / 100) * circumference;

    return (
      <div className={`relative inline-flex items-center justify-center ${className}`}>
        <svg width={circleSize} height={circleSize} className="-rotate-90">
          <circle cx={circleSize / 2} cy={circleSize / 2} r={radius} fill="none" stroke="#E2E8F0" strokeWidth={strokeWidth} />
          <circle
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={radius}
            fill="none"
            stroke={color === 'primary' ? '#2563EB' : color === 'success' ? '#22C55E' : color === 'warning' ? '#F59E0B' : '#EF4444'}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>
        {showLabel && (
          <span className="absolute text-xs font-semibold text-foreground">
            {label || `${Math.round(pct)}%`}
          </span>
        )}
      </div>
    );
  }

  if (variant === 'steps') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {Array.from({ length: steps }).map((_, i) => (
          <React.Fragment key={i}>
            <div className={[
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
              i < currentStep ? `${colorStyles[color]} text-white` : i === currentStep ? 'border-2 border-brand-500 text-brand-600 bg-brand-50' : 'bg-ink-100 text-muted',
            ].join(' ')}>
              {i < currentStep ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            {i < steps - 1 && (
              <div className={`flex-1 h-0.5 rounded ${i < currentStep ? colorStyles[color] : 'bg-ink-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  }

  // linear
  return (
    <div className={`w-full ${className}`}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-xs font-medium text-muted">{label}</span>}
          {showLabel && <span className="text-xs text-muted">{Math.round(pct)}%</span>}
        </div>
      )}
      <div className={`w-full bg-ink-100 rounded-full overflow-hidden ${trackSizes[size]}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${colorStyles[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};
