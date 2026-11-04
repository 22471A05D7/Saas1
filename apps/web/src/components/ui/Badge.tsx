import { cn } from '@/lib/format';

type Tone = 'neutral' | 'brand' | 'success' | 'warn' | 'danger';

const TONES: Record<Tone, string> = {
  neutral: 'bg-line/60 text-ink-muted ring-line',
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  success: 'bg-success-50 text-success-700 ring-success-600/20',
  warn: 'bg-warn-50 text-warn-700 ring-warn-600/20',
  danger: 'bg-danger-50 text-danger-700 ring-danger-600/20',
};

const DOTS: Record<Tone, string> = {
  neutral: 'bg-ink-subtle',
  brand: 'bg-brand-600',
  success: 'bg-success-600',
  warn: 'bg-warn-600',
  danger: 'bg-danger-600',
};

export function Badge({
  tone = 'neutral',
  children,
  dot = false,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOTS[tone])} /> : null}
      {children}
    </span>
  );
}
