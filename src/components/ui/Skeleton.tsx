import React from 'react';

type SkeletonVariant = 'text' | 'circular' | 'rectangular' | 'card' | 'table';

interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string;
  height?: string;
  rows?: number;
  className?: string;
}

const baseClass = 'bg-slate-100 animate-pulse rounded';

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  rows = 1,
  className = '',
}) => {
  if (variant === 'circular') {
    return (
      <div
        className={`${baseClass} rounded-full ${className}`}
        style={{ width: width || '40px', height: height || '40px' }}
      />
    );
  }

  if (variant === 'rectangular') {
    return (
      <div
        className={`${baseClass} rounded-xl ${className}`}
        style={{ width: width || '100%', height: height || '120px' }}
      />
    );
  }

  if (variant === 'card') {
    return (
      <div className={`border border-slate-200 rounded-xl p-5 space-y-4 ${className}`}>
        <div className="flex items-center gap-3">
          <div className={`${baseClass} rounded-full w-10 h-10`} />
          <div className="flex-1 space-y-2">
            <div className={`${baseClass} h-4 w-1/3`} />
            <div className={`${baseClass} h-3 w-1/2`} />
          </div>
        </div>
        <div className="space-y-2">
          <div className={`${baseClass} h-3 w-full`} />
          <div className={`${baseClass} h-3 w-4/5`} />
          <div className={`${baseClass} h-3 w-3/5`} />
        </div>
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className={`${baseClass} h-10 w-full rounded-lg`} />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={`${baseClass} h-12 w-full rounded-lg`} />
        ))}
      </div>
    );
  }

  // text variant
  return (
    <div className={`space-y-2 ${className}`} style={{ width: width || '100%' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`${baseClass} rounded-md`}
          style={{
            height: height || '14px',
            width: i === rows - 1 && rows > 1 ? '70%' : '100%',
          }}
        />
      ))}
    </div>
  );
};
