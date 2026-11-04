'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { TextInput } from '@/components/ui/Field';
import { ApiError, type FieldErrors } from '@/lib/api';

const EMPTY = {
  name: '',
  email: '',
  organizationName: '',
  password: '',
  confirmPassword: '',
};

export default function SignupPage() {
  const { register } = useAuth();

  const [values, setValues] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof typeof EMPTY) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setValues((current) => ({ ...current, [field]: event.target.value }));
      // Clear the field's error as soon as the user starts correcting it.
      setFieldErrors((current) => {
        if (!current[field]) return current;
        const next = { ...current };
        delete next[field];
        return next;
      });
    };
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    // Catch the mismatch before a round trip; the API validates it too.
    if (values.password !== values.confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    setSubmitting(true);
    setFieldErrors({});

    try {
      await register(values);
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.fieldErrors);
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
          <h2 className="text-base font-semibold tracking-tight text-ink">Create your account</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Your organization is created automatically and its data stays private to your team.
          </p>
        </div>

        {formError ? (
          <Alert tone="danger" className="mb-4">
            {formError}
          </Alert>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <TextInput
            label="Full name"
            name="name"
            autoComplete="name"
            placeholder="Jordan Avery"
            value={values.name}
            onChange={update('name')}
            error={fieldErrors.name}
            required
            autoFocus
          />

          <TextInput
            label="Work email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={values.email}
            onChange={update('email')}
            error={fieldErrors.email}
            required
          />

          <TextInput
            label="Organization name"
            name="organizationName"
            autoComplete="organization"
            placeholder="Avery Supply Co."
            value={values.organizationName}
            onChange={update('organizationName')}
            error={fieldErrors.organizationName}
            required
          />

          <TextInput
            label="Password"
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={values.password}
            onChange={update('password')}
            error={fieldErrors.password}
            hint="Use at least 8 characters."
            required
          />

          <TextInput
            label="Confirm password"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={values.confirmPassword}
            onChange={update('confirmPassword')}
            error={fieldErrors.confirmPassword}
            required
          />

          <Button type="submit" className="w-full" size="lg" loading={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-muted">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
