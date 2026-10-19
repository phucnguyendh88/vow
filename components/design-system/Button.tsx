// components/design-system/Button.tsx
import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant: 'primary' | 'secondary' | 'ghost';
  size?: 'default' | 'icon';
}

export const Button: React.FC<ButtonProps> = ({
  className,
  children,
  loading = false,
  variant = 'primary',
  size = 'default',
  disabled,
  ...rest
}) => {
  const base = 'rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary';
  const variantClasses: Record<'primary' | 'secondary' | 'ghost', string> = {
    primary: 'bg-gold text-ink font-semibold hover:brightness-105 active:scale-[0.99]',
    secondary: 'bg-surface2 text-cream hover:bg-surface3 border border-white/5',
    ghost: 'bg-transparent text-cream hover:bg-surface2',
  };
  const sizeClasses: Record<'default' | 'icon', string> = {
    default: 'px-4 py-2',
    icon: 'p-2',
  };

  return (
    <button
      className={cn(base, variantClasses[variant], sizeClasses[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        </svg>
      )}
      {children}
    </button>
  );
};
