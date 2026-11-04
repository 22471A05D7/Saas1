'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageHeader } from '@/components/layout/AppShell';
import { ProductForm } from '@/components/products/ProductForm';

export default function NewProductPage() {
  const { organization } = useAuth();

  return (
    <>
      <nav className="mb-4 text-[13px]" aria-label="Breadcrumb">
        <Link href="/products" className="text-ink-muted hover:text-ink">
          Products
        </Link>
        <span className="mx-1.5 text-ink-subtle">/</span>
        <span className="text-ink">New</span>
      </nav>

      <PageHeader title="Add product" description="Create a new product in your catalog." />

      <ProductForm
        mode="create"
        organizationDefaultThreshold={organization?.defaultLowStockThreshold ?? 10}
      />
    </>
  );
}
