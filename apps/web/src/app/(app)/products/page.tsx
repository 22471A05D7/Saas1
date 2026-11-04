'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { StockAdjustDialog } from '@/components/products/StockAdjustDialog';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { SelectInput } from '@/components/ui/Field';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { ApiError, api } from '@/lib/api';
import {
  STOCK_STATUS_LABEL,
  cn,
  formatCurrency,
  formatDate,
  formatNumber,
  stockStatusTone,
} from '@/lib/format';
import type { Pagination, Product, ProductSortKey, SortOrder, StatusFilter } from '@/lib/types';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const COLUMNS: Array<{
  key: ProductSortKey | null;
  label: string;
  align?: 'right';
  className?: string;
}> = [
  { key: 'name', label: 'Product' },
  { key: 'sku', label: 'SKU' },
  { key: 'quantityOnHand', label: 'Quantity', align: 'right' },
  { key: null, label: 'Stock status' },
  { key: 'sellingPrice', label: 'Selling price', align: 'right' },
  { key: 'createdAt', label: 'Created', className: 'hidden lg:table-cell' },
  { key: null, label: 'Actions', align: 'right' },
];

function SortIcon({ active, order }: { active: boolean; order: SortOrder }) {
  return (
    <svg
      className={cn('h-3 w-3 transition-opacity', active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40')}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {active && order === 'asc' ? <path d="m18 15-6-6-6 6" /> : <path d="m6 9 6 6 6-6" />}
    </svg>
  );
}

function ProductsTable() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  // The URL is the source of truth for list state, so a filtered view is
  // shareable and survives a refresh or the browser back button.
  const page = Number(searchParams.get('page') ?? '1') || 1;
  const pageSize = Number(searchParams.get('pageSize') ?? '10') || 10;
  const search = searchParams.get('search') ?? '';
  const status = (searchParams.get('status') ?? 'ALL') as StatusFilter;
  const sortBy = (searchParams.get('sortBy') ?? 'createdAt') as ProductSortKey;
  const sortOrder = (searchParams.get('sortOrder') ?? 'desc') as SortOrder;

  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The text input is local so typing stays responsive; the URL is updated on
  // a debounce.
  const [searchInput, setSearchInput] = useState(search);

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [stockTarget, setStockTarget] = useState<Product | null>(null);

  const setParams = useCallback(
    (updates: Record<string, string | number | null>, { resetPage = true } = {}) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') params.delete(key);
        else params.set(key, String(value));
      }

      if (resetPage && !('page' in updates)) params.delete('page');

      const query = params.toString();
      router.replace(query ? `/products?${query}` : '/products', { scroll: false });
    },
    [router, searchParams],
  );

  // Keep the input in sync when the URL changes from elsewhere (back button).
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onSearchChange(value: string) {
    setSearchInput(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setParams({ search: value || null }), 350);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, meta } = await api.get<{ products: Product[] }>('/products', {
        page,
        pageSize,
        search: search || undefined,
        status,
        sortBy,
        sortOrder,
      });

      setProducts(data.products);
      setPagination((meta?.pagination as Pagination | undefined) ?? null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load your products.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, status, sortBy, sortOrder]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleSort(key: ProductSortKey) {
    // Clicking the active column flips direction; a new column starts ascending.
    const nextOrder: SortOrder = sortBy === key && sortOrder === 'asc' ? 'desc' : 'asc';
    setParams({ sortBy: key, sortOrder: nextOrder });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      await api.delete(`/products/${deleteTarget.id}`);
      toast.success(`Deleted ${deleteTarget.name}`);
      setDeleteTarget(null);

      // Stepping back a page avoids landing on an empty final page.
      if (products.length === 1 && page > 1) setParams({ page: page - 1 }, { resetPage: false });
      else await load();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not delete this product.');
    } finally {
      setDeleting(false);
    }
  }

  const filtersActive = Boolean(search) || status !== 'ALL';
  const rangeStart = pagination && pagination.total > 0 ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = pagination ? Math.min(page * pageSize, pagination.total) : 0;

  const statusOptions = useMemo(
    () => [
      { value: 'ALL', label: 'All statuses' },
      { value: 'IN_STOCK', label: 'In stock' },
      { value: 'LOW_STOCK', label: 'Low stock' },
      { value: 'OUT_OF_STOCK', label: 'Out of stock' },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Products"
        description="Manage your catalog, stock levels, and pricing."
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

      <Card className="overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <div className="relative min-w-[200px] flex-1">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search by name or SKU…"
              aria-label="Search products by name or SKU"
              className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink shadow-sm transition-colors placeholder:text-ink-subtle hover:border-ink-subtle/60 focus:border-brand-500"
            />
          </div>

          <SelectInput
            label="Stock status"
            hideLabel
            value={status}
            onChange={(event) => setParams({ status: event.target.value })}
            className="h-9 w-auto min-w-[9.5rem] text-[13px]"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>

          <SelectInput
            label="Rows per page"
            hideLabel
            value={String(pageSize)}
            onChange={(event) => setParams({ pageSize: event.target.value })}
            className="h-9 w-auto text-[13px]"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </SelectInput>

          {filtersActive ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setParams({ search: null, status: null })}
            >
              Clear
            </Button>
          ) : null}
        </div>

        {error ? (
          <div className="p-4">
            <Alert tone="danger" title="Could not load products">
              <p>{error}</p>
              <Button variant="secondary" size="sm" className="mt-2.5" onClick={() => void load()}>
                Try again
              </Button>
            </Alert>
          </div>
        ) : loading ? (
          <SkeletonTable rows={pageSize > 10 ? 8 : 5} columns={6} />
        ) : products.length === 0 ? (
          filtersActive ? (
            <EmptyState
              title="No matching products"
              description="No products match your search or filter. Try a different term."
              action={
                <Button variant="secondary" onClick={() => setParams({ search: null, status: null })}>
                  Clear filters
                </Button>
              }
              icon={
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              }
            />
          ) : (
            <EmptyState
              title="No products yet"
              description="Add your first product to start tracking stock levels, pricing, and low-stock alerts."
              action={
                <Link href="/products/new">
                  <Button>Add your first product</Button>
                </Link>
              }
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas/60 text-left">
                  {COLUMNS.map((column) => (
                    <th
                      key={column.label}
                      scope="col"
                      aria-sort={
                        column.key && sortBy === column.key
                          ? sortOrder === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : undefined
                      }
                      className={cn(
                        'px-5 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-ink-subtle',
                        column.align === 'right' && 'text-right',
                        column.className,
                      )}
                    >
                      {column.key ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column.key as ProductSortKey)}
                          className={cn(
                            'group inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-ink',
                            sortBy === column.key && 'text-ink',
                          )}
                        >
                          {column.label}
                          <SortIcon active={sortBy === column.key} order={sortOrder} />
                        </button>
                      ) : (
                        column.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {products.map((product) => (
                  <tr key={product.id} className="transition-colors hover:bg-canvas/70">
                    <td className="max-w-[15rem] px-5 py-3">
                      <Link
                        href={`/products/${product.id}/edit`}
                        className="block truncate font-medium text-ink hover:text-brand-600"
                        title={product.name}
                      >
                        {product.name}
                      </Link>
                      {product.description ? (
                        <p className="mt-0.5 truncate text-xs text-ink-subtle" title={product.description}>
                          {product.description}
                        </p>
                      ) : null}
                    </td>

                    <td className="px-5 py-3 font-mono text-[13px] text-ink-muted">{product.sku}</td>

                    <td className="tnum px-5 py-3 text-right font-medium text-ink">
                      {formatNumber(product.quantityOnHand)}
                      <span className="ml-1 text-xs font-normal text-ink-subtle">
                        / {formatNumber(product.effectiveLowStockThreshold)}
                      </span>
                    </td>

                    <td className="px-5 py-3">
                      <Badge tone={stockStatusTone(product.stockStatus)} dot>
                        {STOCK_STATUS_LABEL[product.stockStatus]}
                      </Badge>
                    </td>

                    <td className="tnum px-5 py-3 text-right text-ink">
                      {formatCurrency(product.sellingPrice)}
                    </td>

                    <td className="hidden px-5 py-3 text-ink-muted lg:table-cell">
                      {formatDate(product.createdAt)}
                    </td>

                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="secondary" size="sm" onClick={() => setStockTarget(product)}>
                          Adjust
                        </Button>
                        <Link href={`/products/${product.id}/edit`}>
                          <Button variant="secondary" size="sm">
                            Edit
                          </Button>
                        </Link>
                        <Button
                          variant="danger-soft"
                          size="sm"
                          onClick={() => setDeleteTarget(product)}
                          aria-label={`Delete ${product.name}`}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.total > 0 && !loading && !error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
            <p className="tnum text-[13px] text-ink-muted">
              Showing <span className="font-medium text-ink">{formatNumber(rangeStart)}</span>–
              <span className="font-medium text-ink">{formatNumber(rangeEnd)}</span> of{' '}
              <span className="font-medium text-ink">{formatNumber(pagination.total)}</span>
            </p>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={!pagination.hasPreviousPage}
                onClick={() => setParams({ page: page - 1 }, { resetPage: false })}
              >
                Previous
              </Button>
              <span className="tnum px-1 text-[13px] text-ink-muted">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={!pagination.hasNextPage}
                onClick={() => setParams({ page: page + 1 }, { resetPage: false })}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        loading={deleting}
        title="Delete this product?"
        confirmLabel={deleting ? 'Deleting…' : 'Delete product'}
        description={
          deleteTarget ? (
            <>
              <span className="font-medium text-ink">{deleteTarget.name}</span>{' '}
              <span className="font-mono text-[13px] text-ink-subtle">({deleteTarget.sku})</span> and
              its stock record will be permanently removed. This cannot be undone.
            </>
          ) : null
        }
      />

      <StockAdjustDialog
        product={stockTarget}
        open={stockTarget !== null}
        onClose={() => setStockTarget(null)}
        onAdjusted={(updated) => {
          // Patch the row in place so the table reflects the new quantity and
          // status without refetching the whole page.
          setProducts((current) =>
            current.map((item) => (item.id === updated.id ? updated : item)),
          );
        }}
      />
    </>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<Card className="h-96" />}>
      <ProductsTable />
    </Suspense>
  );
}
