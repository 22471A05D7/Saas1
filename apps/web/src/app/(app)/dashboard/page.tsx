'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { STAT_ICONS, StatCard } from '@/components/dashboard/StatCard';
import { PageHeader } from '@/components/layout/AppShell';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { ApiError, api } from '@/lib/api';
import { STOCK_STATUS_LABEL, formatCurrency, formatNumber, stockStatusTone } from '@/lib/format';
import type { DashboardSummary, LowStockItem } from '@/lib/types';

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Both panels are independent, so they load in parallel.
      const [summaryResult, lowStockResult] = await Promise.all([
        api.get<{ summary: DashboardSummary }>('/dashboard/summary'),
        api.get<{ items: LowStockItem[] }>('/dashboard/low-stock', { limit: 10 }),
      ]);

      setSummary(summaryResult.data.summary);
      setLowStock(lowStockResult.data.items);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Could not load your dashboard.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hasProducts = (summary?.totalProducts ?? 0) > 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          summary
            ? `Inventory overview for ${summary.organization.name}`
            : 'Inventory overview for your organization'
        }
        action={
          <Link href="/products/new">
            <Button>
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add product
            </Button>
          </Link>
        }
      />

      {error ? (
        <Alert tone="danger" title="Could not load the dashboard" className="mb-6">
          <p>{error}</p>
          <Button variant="secondary" size="sm" className="mt-2.5" onClick={() => void load()}>
            Try again
          </Button>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total products"
          value={formatNumber(summary?.totalProducts ?? 0)}
          hint={summary ? 'Distinct SKUs in your catalog' : undefined}
          tone="brand"
          icon={STAT_ICONS.products}
          loading={loading}
        />
        <StatCard
          label="Total stock units"
          value={formatNumber(summary?.totalStockUnits ?? 0)}
          hint={summary ? `${formatCurrency(summary.inventoryRetailValue)} retail value` : undefined}
          tone="neutral"
          icon={STAT_ICONS.units}
          loading={loading}
        />
        <StatCard
          label="Low stock"
          value={formatNumber(summary?.lowStockProducts ?? 0)}
          hint={summary ? 'At or below the reorder threshold' : undefined}
          tone="warn"
          icon={STAT_ICONS.low}
          loading={loading}
        />
        <StatCard
          label="Out of stock"
          value={formatNumber(summary?.outOfStockProducts ?? 0)}
          hint={summary ? 'Zero units on hand' : undefined}
          tone="danger"
          icon={STAT_ICONS.out}
          loading={loading}
        />
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader
          title="Needs restocking"
          description={
            summary
              ? `Products at or below their threshold. Organization default is ${summary.organization.defaultLowStockThreshold} units.`
              : 'Products at or below their low-stock threshold.'
          }
          action={
            <Link href="/products?status=LOW_STOCK">
              <Button variant="secondary" size="sm">
                View all
              </Button>
            </Link>
          }
        />

        {loading ? (
          <SkeletonTable rows={4} columns={5} />
        ) : lowStock.length === 0 ? (
          hasProducts ? (
            <EmptyState
              title="Everything is well stocked"
              description="No products are at or below their low-stock threshold right now."
              icon={
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m5 13 4 4L19 7" />
                </svg>
              }
            />
          ) : (
            <EmptyState
              title="No products yet"
              description="Add your first product to start tracking stock levels and low-stock alerts."
              action={
                <Link href="/products/new">
                  <Button>Add your first product</Button>
                </Link>
              }
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas/60 text-left">
                  <th className="px-5 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-ink-subtle">
                    Product
                  </th>
                  <th className="px-5 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-ink-subtle">
                    SKU
                  </th>
                  <th className="px-5 py-2.5 text-right text-[12px] font-semibold uppercase tracking-wider text-ink-subtle">
                    Available
                  </th>
                  <th className="px-5 py-2.5 text-right text-[12px] font-semibold uppercase tracking-wider text-ink-subtle">
                    Threshold
                  </th>
                  <th className="px-5 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-ink-subtle">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lowStock.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-canvas/70">
                    <td className="px-5 py-3">
                      <Link
                        href={`/products/${item.id}/edit`}
                        className="font-medium text-ink hover:text-brand-600"
                      >
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 font-mono text-[13px] text-ink-muted">{item.sku}</td>
                    <td className="tnum px-5 py-3 text-right font-medium text-ink">
                      {formatNumber(item.quantityOnHand)}
                    </td>
                    <td className="tnum px-5 py-3 text-right text-ink-muted">
                      {formatNumber(item.effectiveLowStockThreshold)}
                      {item.lowStockThreshold === null ? (
                        <span className="ml-1 text-xs text-ink-subtle">(default)</span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={stockStatusTone(item.stockStatus)} dot>
                        {STOCK_STATUS_LABEL[item.stockStatus]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {summary && hasProducts ? (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <p className="text-[13px] font-medium text-ink-muted">Inventory value at cost</p>
            <p className="tnum mt-1 text-xl font-semibold tracking-tight text-ink">
              {formatCurrency(summary.inventoryCostValue)}
            </p>
            <p className="mt-1 text-xs text-ink-subtle">Sum of quantity on hand × cost price</p>
          </Card>
          <Card className="p-5">
            <p className="text-[13px] font-medium text-ink-muted">Inventory value at retail</p>
            <p className="tnum mt-1 text-xl font-semibold tracking-tight text-ink">
              {formatCurrency(summary.inventoryRetailValue)}
            </p>
            <p className="mt-1 text-xs text-ink-subtle">Sum of quantity on hand × selling price</p>
          </Card>
        </div>
      ) : null}
    </>
  );
}
