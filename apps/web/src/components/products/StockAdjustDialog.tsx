'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextArea, TextInput } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { ApiError, api } from '@/lib/api';
import { cn, formatNumber } from '@/lib/format';
import type { Product } from '@/lib/types';

type AdjustmentType = 'increase' | 'decrease' | 'set';

const TABS: Array<{ value: AdjustmentType; label: string }> = [
  { value: 'increase', label: 'Add stock' },
  { value: 'decrease', label: 'Remove stock' },
  { value: 'set', label: 'Set exact' },
];

/**
 * Stock adjustment dialog.
 *
 * "Add" and "Remove" send a *relative* change, which the API applies as a
 * single atomic UPDATE — so two people adjusting the same product at the same
 * time cannot overwrite each other's change. "Set exact" is an absolute write,
 * intended for stock counts.
 */
export function StockAdjustDialog({
  product,
  open,
  onClose,
  onAdjusted,
}: {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onAdjusted: (product: Product) => void;
}) {
  const toast = useToast();

  const [type, setType] = useState<AdjustmentType>('increase');
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  // Reset to a clean state whenever the dialog opens for a product.
  useEffect(() => {
    if (!open) return;
    setType('increase');
    setQuantity('1');
    setNote('');
    setError(null);
    setFieldError(undefined);
    setSubmitting(false);
  }, [open, product?.id]);

  if (!product) return null;

  const parsed = Number(quantity);
  const valid = Number.isInteger(parsed) && parsed >= 0;

  const projected =
    !valid
      ? product.quantityOnHand
      : type === 'increase'
        ? product.quantityOnHand + parsed
        : type === 'decrease'
          ? product.quantityOnHand - parsed
          : parsed;

  const wouldGoNegative = projected < 0;

  async function onSubmit() {
    setError(null);
    setFieldError(undefined);

    if (!valid) {
      setFieldError('Enter a whole number of 0 or more');
      return;
    }

    if (wouldGoNegative) {
      setFieldError(`Only ${formatNumber(product!.quantityOnHand)} units in stock`);
      return;
    }

    setSubmitting(true);

    try {
      const { data } = await api.patch<{ product: Product }>(`/products/${product!.id}/stock`, {
        type,
        quantity: parsed,
        note: note.trim(),
      });

      toast.success(
        type === 'set'
          ? `Stock set to ${formatNumber(data.product.quantityOnHand)}`
          : `${type === 'increase' ? 'Added' : 'Removed'} ${formatNumber(parsed)} units`,
      );

      onAdjusted(data.product);
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        if (caught.fieldErrors.quantity) setFieldError(caught.fieldErrors.quantity);
      } else {
        setError('Something went wrong. Please try again.');
      }
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title="Adjust stock"
      description={
        <>
          <span className="font-medium text-ink">{product.name}</span>
          <span className="text-ink-subtle"> · {product.sku}</span>
        </>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void onSubmit()} loading={submitting} disabled={wouldGoNegative}>
            Apply adjustment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}

        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink">Adjustment type</span>
          <div
            className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-canvas p-1"
            role="radiogroup"
            aria-label="Adjustment type"
          >
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="radio"
                aria-checked={type === tab.value}
                onClick={() => {
                  setType(tab.value);
                  setFieldError(undefined);
                }}
                className={cn(
                  'rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors',
                  type === tab.value
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <TextInput
          label={type === 'set' ? 'New quantity' : 'Quantity'}
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          value={quantity}
          onChange={(event) => {
            setQuantity(event.target.value);
            setFieldError(undefined);
          }}
          error={fieldError}
          data-autofocus
          required
        />

        <TextArea
          label="Note"
          placeholder="Optional — e.g. received PO #1042, damaged in transit, cycle count"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="min-h-[70px]"
        />

        <div className="flex items-center justify-between rounded-lg border border-line bg-canvas px-3.5 py-2.5 text-sm">
          <span className="text-ink-muted">Current</span>
          <span className="tnum font-medium text-ink">
            {formatNumber(product.quantityOnHand)}
          </span>
          <svg
            className="h-4 w-4 text-ink-subtle"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          <span className="text-ink-muted">After</span>
          <span
            className={cn(
              'tnum font-semibold',
              wouldGoNegative ? 'text-danger-600' : 'text-ink',
            )}
          >
            {valid ? formatNumber(projected) : '—'}
          </span>
        </div>

        {wouldGoNegative ? (
          <Alert tone="warn">Stock cannot go below zero. Reduce the quantity to continue.</Alert>
        ) : null}
      </div>
    </Dialog>
  );
}
