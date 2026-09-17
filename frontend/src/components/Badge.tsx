import React from 'react';
import { cn } from '../utils';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  status?: string; // Tự động nhận diện chuỗi: ON_TIME, LATE, ABSENT, PENDING, APPROVED, REJECTED
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant,
  status,
  size = 'md',
  className,
}) => {
  let computedVariant: BadgeVariant = variant || 'neutral';

  if (status) {
    const s = status.toUpperCase();
    if (['ON_TIME', 'APPROVED', 'ACTIVE'].includes(s)) {
      computedVariant = 'success';
    } else if (['LATE', 'PENDING', 'WARNING'].includes(s)) {
      computedVariant = 'warning';
    } else if (['ABSENT', 'REJECTED', 'INACTIVE', 'DANGER'].includes(s)) {
      computedVariant = 'danger';
    } else if (['EARLY_LEAVE', 'EXCUSED_ABSENCE', 'INFO'].includes(s)) {
      computedVariant = 'info';
    }
  }

  const variantStyles: Record<BadgeVariant, string> = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium rounded-full border',
        sizeStyles[size],
        variantStyles[computedVariant],
        className
      )}
    >
      <span
        className={cn('w-1.5 h-1.5 rounded-full', {
          'bg-emerald-500': computedVariant === 'success',
          'bg-amber-500': computedVariant === 'warning',
          'bg-rose-500': computedVariant === 'danger',
          'bg-blue-500': computedVariant === 'info',
          'bg-slate-400': computedVariant === 'neutral',
        })}
      />
      {children}
    </span>
  );
};

export default Badge;
