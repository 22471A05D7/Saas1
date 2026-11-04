import { cn } from '@/lib/format';

type Tone = 'danger' | 'warn' | 'success' | 'info';

const TONES: Record<Tone, string> = {
  danger: 'border-danger-600/25 bg-danger-50 text-danger-700',
  warn: 'border-warn-600/25 bg-warn-50 text-warn-700',
  success: 'border-success-600/25 bg-success-50 text-success-700',
  info: 'border-brand-100 bg-brand-50 text-brand-700',
};

const ICONS: Record<Tone, React.ReactNode> = {
  danger: (
    <path d="M12 9v4m0 4h.01M10.3 3.9 2.4 17.1A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z" />
  ),
  warn: (
    <path d="M12 9v4m0 4h.01M10.3 3.9 2.4 17.1A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z" />
  ),
  success: <path d="m5 13 4 4L19 7" />,
  info: <path d="M12 16v-5m0-4h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />,
};

export function Alert({
  tone = 'danger',
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border px-3.5 py-3 text-sm', TONES[tone], className)}
    >
      <svg
        className="mt-0.5 h-4 w-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {ICONS[tone]}
      </svg>
      <div className="min-w-0">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn(title && 'mt-0.5 opacity-90')}>{children}</div> : null}
      </div>
    </div>
  );
}
