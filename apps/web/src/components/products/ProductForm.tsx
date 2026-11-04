'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { TextArea, TextInput } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { ApiError, api, type FieldErrors } from '@/lib/api';
import type { Product, ProductFormValues } from '@/lib/types';

const EMPTY: ProductFormValues = {
  name: '',
  sku: '',
  description: '',
  quantityOnHand: '0',
  costPrice: '0.00',
  sellingPrice: '0.00',
  lowStockThreshold: '',
};

export function productToFormValues(product: Product): ProductFormValues {
  return {
    name: product.name,
    sku: product.sku,
    description: product.description ?? '',
    quantityOnHand: String(product.quantityOnHand),
    costPrice: product.costPrice,
    sellingPrice: product.sellingPrice,
    lowStockThreshold: product.lowStockThreshold === null ? '' : String(product.lowStockThreshold),
  };
}

/**
 * Create/edit form for a product.
 *
 * In edit mode only the fields the user actually changed are sent, which keeps
 * the PATCH semantics honest and avoids rewriting values another session may
 * have updated in the meantime.
 */
export function ProductForm({
  mode,
  productId,
  initialValues,
  organizationDefaultThreshold,
}: {
  mode: 'create' | 'edit';
  productId?: string;
  initialValues?: ProductFormValues;
  organizationDefaultThreshold: number;
}) {
  const router = useRouter();
  const toast = useToast();

  const [values, setValues] = useState<ProductFormValues>(initialValues ?? EMPTY);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof ProductFormValues) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { value } = event.target;
      setValues((current) => ({ ...current, [field]: value }));
      setFieldErrors((current) => {
        if (!current[field]) return current;
        const next = { ...current };
        delete next[field];
        return next;
      });
    };
  }

  function buildPayload(): Record<string, unknown> {
    const full: Record<string, unknown> = {
      name: values.name.trim(),
      sku: values.sku.trim(),
      description: values.description.trim(),
      quantityOnHand: Number(values.quantityOnHand || 0),
      costPrice: Number(values.costPrice || 0),
      sellingPrice: Number(values.sellingPrice || 0),
      // An empty threshold means "inherit the organization default", which the
      // API stores as NULL.
      lowStockThreshold: values.lowStockThreshold.trim() === ''
        ? null
        : Number(values.lowStockThreshold),
    };

    if (mode === 'create' || !initialValues) return full;

    // Send only what changed.
    const changed: Record<string, unknown> = {};
    for (const key of Object.keys(values) as Array<keyof ProductFormValues>) {
      if (values[key] !== initialValues[key]) changed[key] = full[key];
    }
    return changed;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const payload = buildPayload();

    if (mode === 'edit' && Object.keys(payload).length === 0) {
      toast.info('No changes to save');
      return;
    }

    setSubmitting(true);
    setFieldErrors({});

    try {
      if (mode === 'create') {
        await api.post<{ product: Product }>('/products', payload);
        toast.success('Product created');
      } else {
        await api.patch<{ product: Product }>(`/products/${productId}`, payload);
        toast.success('Product updated');
      }

      router.push('/products');
      // Discard the cached list so it reflects the write.
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.fieldErrors);
        if (Object.keys(error.fieldErrors).length === 0) setFormError(error.message);
        else if (error.code === 'DUPLICATE_SKU') setFormError(error.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <Card>
        <CardHeader title="Product details" description="Identify the item in your catalog." />
        <CardBody className="space-y-4">
          <TextInput
            label="Product name"
            name="name"
            placeholder="Ceramic Pour-Over Dripper"
            value={values.name}
            onChange={update('name')}
            error={fieldErrors.name}
            required
            autoFocus={mode === 'create'}
          />

          <TextInput
            label="SKU"
            name="sku"
            placeholder="CPD-001"
            value={values.sku}
            onChange={update('sku')}
            error={fieldErrors.sku}
            hint="Must be unique within your organization."
            required
            className="font-mono"
          />

          <TextArea
            label="Description"
            name="description"
            placeholder="Optional notes about this product."
            value={values.description}
            onChange={update('description')}
            error={fieldErrors.description}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Stock and pricing"
          description="Quantities are whole units; prices are stored with 2 decimal places."
        />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput
            label="Quantity on hand"
            name="quantityOnHand"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={values.quantityOnHand}
            onChange={update('quantityOnHand')}
            error={fieldErrors.quantityOnHand}
            hint={mode === 'edit' ? 'Sets the absolute quantity.' : undefined}
            required
          />

          <TextInput
            label="Low stock threshold"
            name="lowStockThreshold"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            placeholder={`Default (${organizationDefaultThreshold})`}
            value={values.lowStockThreshold}
            onChange={update('lowStockThreshold')}
            error={fieldErrors.lowStockThreshold}
            hint={`Leave blank to use the organization default of ${organizationDefaultThreshold}.`}
          />

          <TextInput
            label="Cost price"
            name="costPrice"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={values.costPrice}
            onChange={update('costPrice')}
            error={fieldErrors.costPrice}
            required
          />

          <TextInput
            label="Selling price"
            name="sellingPrice"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={values.sellingPrice}
            onChange={update('sellingPrice')}
            error={fieldErrors.sellingPrice}
            required
          />
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link href="/products">
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </Link>
        <Button type="submit" loading={submitting}>
          {submitting
            ? mode === 'create'
              ? 'Creating…'
              : 'Saving…'
            : mode === 'create'
              ? 'Create product'
              : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
