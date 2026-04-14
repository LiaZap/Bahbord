'use client';

import { cn } from '@/lib/utils/cn';
import { ReactNode } from 'react';

const sizeClasses = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-0.5',
} as const;

interface BadgeProps {
  children: ReactNode;
  color?: string;
  variant?: 'filled' | 'outline';
  size?: 'sm' | 'md';
  className?: string;
}

export default function Badge({
  children,
  color = '#3b82f6',
  variant = 'filled',
  size = 'md',
  className,
}: BadgeProps) {
  const isFilled = variant === 'filled';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded font-semibold',
        sizeClasses[size],
        !isFilled && 'border bg-transparent',
        className
      )}
      style={
        isFilled
          ? { backgroundColor: color + '20', color }
          : { borderColor: color + '40', color }
      }
    >
      {children}
    </span>
  );
}
