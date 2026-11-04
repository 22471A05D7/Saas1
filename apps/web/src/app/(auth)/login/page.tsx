'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { TextInput } from '@/components/ui/Field';
import { ApiError, type FieldErrors } from '@/lib/api';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    try {
      await login(email, password);

      // Return the user to the page that bounced them here, if any.
      const next = searchParams.get('next');
      if (next && next.startsWith('/')) router.replace(next);
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.fieldErrors);
        // Credential failures carry no field details, so they surface at the
        // top of the form instead.
        if (Object.keys(error.fieldErrors).length === 0) setFormError(error.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardBody className="p-6">
        <div className="mb-5">
          <h2 className="text-base font-semibold tracking-tight text-ink">Sign in</h2>
          <p className="mt-0.5 text-sm text-ink-muted">Welcome back. Enter your credentials.</p>
        </div>

        {formError ? (
          <Alert tone="danger" className="mb-4">
            {formError}
          </Alert>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <TextInput
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldErrors.email}
            required
            autoFocus
          />

          <TextInput
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors.password}
            required
          />

          <Button type="submit" className="w-full" size="lg" loading={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-muted">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-medium text-brand-600 hover:text-brand-700">
            Create one
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}

export default function LoginPage() {
  // `useSearchParams` requires a Suspense boundary during prerendering.
  return (
    <Suspense fallback={<Card><CardBody className="h-72" /></Card>}>
      <LoginForm />
    </Suspense>
  );
}
