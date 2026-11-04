'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageHeader } from '@/components/layout/AppShell';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { TextInput } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { ApiError, api, type FieldErrors } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/format';
import type { Organization } from '@/lib/types';

interface SettingsResponse {
  organization: Organization;
  stats: { userCount: number; productCount: number };
}

export default function SettingsPage() {
  const toast = useToast();
  const { refresh } = useAuth();

  const [data, setData] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [threshold, setThreshold] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const result = await api.get<SettingsResponse>('/settings');
      setData(result.data);
      setName(result.data.organization.name);
      setThreshold(String(result.data.organization.defaultLowStockThreshold));
    } catch (caught) {
      setLoadError(caught instanceof ApiError ? caught.message : 'Could not load your settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty =
    data !== null &&
    (name !== data.organization.name ||
      threshold !== String(data.organization.defaultLowStockThreshold));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!data || !dirty) return;

    setSaving(true);
    setFormError(null);
    setFieldErrors({});

    // Send only the settings that changed.
    const payload: Record<string, unknown> = {};
    if (name !== data.organization.name) payload.name = name.trim();
    if (threshold !== String(data.organization.defaultLowStockThreshold)) {
      payload.defaultLowStockThreshold = Number(threshold);
    }

    try {
      const result = await api.patch<{ organization: Organization }>('/settings', payload);

      setData((current) =>
        current ? { ...current, organization: result.data.organization } : current,
      );
      setName(result.data.organization.name);
      setThreshold(String(result.data.organization.defaultLowStockThreshold));

      // The sidebar and the product forms read the organization from the
      // session, so it must be re-read for the new default to take effect
      // everywhere immediately.
      await refresh();

      toast.success('Settings saved');
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFieldErrors(caught.fieldErrors);
        if (Object.keys(caught.fieldErrors).length === 0) setFormError(caught.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    if (!data) return;
    setName(data.organization.name);
    setThreshold(String(data.organization.defaultLowStockThreshold));
    setFieldErrors({});
    setFormError(null);
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your organization profile and inventory defaults."
      />

      {loadError ? (
        <Alert tone="danger" title="Could not load settings" className="mb-6">
          <p>{loadError}</p>
          <Button variant="secondary" size="sm" className="mt-2.5" onClick={() => void load()}>
            Try again
          </Button>
        </Alert>
      ) : null}

      <div className="max-w-2xl space-y-5">
        <form onSubmit={onSubmit} noValidate>
          <Card>
            <CardHeader
              title="Organization"
              description="These settings apply to everyone in your organization."
            />
            <CardBody className="space-y-4">
              {formError ? <Alert tone="danger">{formError}</Alert> : null}

              {loading ? (
                <>
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </>
              ) : (
                <>
                  <TextInput
                    label="Organization name"
                    name="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    error={fieldErrors.name}
                    required
                  />

                  <TextInput
                    label="Default low stock threshold"
                    name="defaultLowStockThreshold"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={threshold}
                    onChange={(event) => setThreshold(event.target.value)}
                    error={fieldErrors.defaultLowStockThreshold}
                    hint="Applied to every product that does not set its own threshold. A product is flagged low when its quantity is at or below this number."
                    required
                  />
                </>
              )}
            </CardBody>

            <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-line bg-canvas/60 px-5 py-3.5">
              <Button
                type="button"
                variant="secondary"
                onClick={reset}
                disabled={!dirty || saving || loading}
              >
                Reset
              </Button>
              <Button type="submit" loading={saving} disabled={!dirty || loading}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </Card>
        </form>

        <Card>
          <CardHeader title="Organization details" description="Read-only information." />
          <CardBody>
            <dl className="divide-y divide-line text-sm">
              <div className="flex items-center justify-between py-2.5 first:pt-0">
                <dt className="text-ink-muted">Members</dt>
                <dd className="tnum font-medium text-ink">
                  {loading ? '—' : formatNumber(data?.stats.userCount ?? 0)}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-ink-muted">Products</dt>
                <dd className="tnum font-medium text-ink">
                  {loading ? '—' : formatNumber(data?.stats.productCount ?? 0)}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5 last:pb-0">
                <dt className="text-ink-muted">Created</dt>
                <dd className="font-medium text-ink">
                  {loading || !data?.organization.createdAt
                    ? '—'
                    : formatDate(data.organization.createdAt)}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
