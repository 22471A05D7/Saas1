import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/format';

type Tone = 'brand' | 'neutral' | 'warn' | 'danger';

const ICON_TONES: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-600',
  neutral: 'bg-line/60 text-ink-muted',
  warn: 'bg-warn-50 text-warn-600',
  danger: 'bg-danger-50 text-danger-600',
};

export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
  loading = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  icon: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink-muted">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-20" />
          ) : (
            <p className="tnum mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</p>
          )}
          {hint && !loading ? <p className="mt-1 text-xs text-ink-subtle">{hint}</p> : null}
        </div>
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            ICON_TONES[tone],
          )}
        >
          <svg
            className="h-[18px] w-[18px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {icon}
          </svg>
        </div>
      </div>
    </Card>
  );
}

export const STAT_ICONS = {
  products: (
    <>
      <path d="M20 7 12 3 4 7v10l8 4 8-4V7Z" />
      <path d="m4 7 8 4 8-4M12 21V11" />
    </>
  ),
  units: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 16V9m5 7V5m5 11v-4" />
    </>
  ),
  low: (
    <>
      <path d="M12 9v4m0 4h.01" />
      <path d="M10.3 3.9 2.4 17.1A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </>
  ),
  out: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6M9 9l6 6" />
    </>
  ),
} as const;
