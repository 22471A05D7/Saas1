import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <p className="text-[13px] font-semibold uppercase tracking-wider text-brand-600">404</p>
      <h1 className="text-xl font-semibold tracking-tight text-ink">Page not found</h1>
      <p className="max-w-sm text-sm text-ink-muted">
        The page you are looking for does not exist or may have been moved.
      </p>
      <Link href="/dashboard">
        <Button>Back to dashboard</Button>
      </Link>
    </div>
  );
}
