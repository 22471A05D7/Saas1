'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageHeader } from '@/components/layout/AppShell';
import { ProductForm, productToFormValues } from '@/components/products/ProductForm';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { ApiError, api } from '@/lib/api';
import { STOCK_STATUS_LABEL, formatDate, stockStatusTone } from '@/lib/format';
import type { Product } from '@/lib/types';

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const { organization } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data } = await api.get<{ product: Product }>(`/products/${params.id}`);
      setProduct(data.product);
    } catch (caught) {
      if (caught instanceof ApiError) {
        // A product belonging to another organization returns 404 too, so there
        // is nothing here to distinguish — which is the point.
        setError({ message: caught.message, notFound: caught.status === 404 });
      } else {
        setError({ message: 'Could not load this product.', notFound: false });
      }
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <>
        <PageHeader title="Edit product" />
        <div className="space-y-5">
          <Card>
            <CardBody className="space-y-4 py-6">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-20" />
            </CardBody>
          </Card>
          <Card>
            <CardBody className="grid grid-cols-1 gap-4 py-6 sm:grid-cols-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </CardBody>
          </Card>
        </div>
      </>
    );
  }

  if (error || !product) {
    return (
      <>
        <PageHeader title="Edit product" />
        <Alert tone="danger" title={error?.notFound ? 'Product not found' : 'Could not load product'}>
          <p>
            {error?.notFound
              ? 'This product does not exist, or it belongs to a different organization.'
              : (error?.message ?? 'Something went wrong.')}
          </p>
          <div className="mt-2.5 flex gap-2">
            <Link href="/products">
              <Button variant="secondary" size="sm">
                Back to products
              </Button>
            </Link>
            {!error?.notFound ? (
              <Button variant="secondary" size="sm" onClick={() => void load()}>
                Try again
              </Button>
            ) : null}
          </div>
        </Alert>
      </>
    );
  }

  return (
    <>
      <nav className="mb-4 text-[13px]" aria-label="Breadcrumb">
        <Link href="/products" className="text-ink-muted hover:text-ink">
          Products
        </Link>
        <span className="mx-1.5 text-ink-subtle">/</span>
        <span className="truncate text-ink">{product.name}</span>
      </nav>

      <PageHeader
        title="Edit product"
        description={`Last updated ${formatDate(product.updatedAt)}`}
        action={
          <Badge tone={stockStatusTone(product.stockStatus)} dot>
            {STOCK_STATUS_LABEL[product.stockStatus]}
          </Badge>
        }
      />

      {product.lastStockNote ? (
        <Alert tone="info" title="Last stock adjustment note" className="mb-5">
          {product.lastStockNote}
        </Alert>
      ) : null}

      <ProductForm
        mode="edit"
        productId={product.id}
        initialValues={productToFormValues(product)}
        organizationDefaultThreshold={
          organization?.defaultLowStockThreshold ?? product.effectiveLowStockThreshold
        }
      />
    </>
  );
}
