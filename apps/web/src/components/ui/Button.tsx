import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/format';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-soft';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-700 disabled:bg-brand-600/50',
  secondary:
    'bg-surface text-ink border border-line shadow-sm hover:bg-canvas active:bg-line/40 disabled:text-ink-subtle',
  ghost: 'text-ink-muted hover:bg-line/50 hover:text-ink',
  danger: 'bg-danger-600 text-white shadow-sm hover:bg-danger-700 disabled:bg-danger-600/50',
  'danger-soft':
    'bg-surface text-danger-600 border border-line shadow-sm hover:bg-danger-50 hover:border-danger-600/30',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-sm gap-2 rounded-lg',
};

/**
 * The single button primitive used across the app. `loading` disables the
 * button and swaps in a spinner, which keeps every async action's pending state
 * consistent and prevents double submits.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-70',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner className="h-4 w-4" /> : null}
      {children}
    </button>
  );
});
