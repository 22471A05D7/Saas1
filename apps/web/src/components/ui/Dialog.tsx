'use client';

import { useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/format';
import { Button } from './Button';

/**
 * Modal dialog.
 *
 * Deliberately built on a focus-trapping div rather than `window.confirm`, both
 * for visual consistency and because native dialogs block the page. Escape and
 * backdrop clicks close it, focus moves inside on open and returns to the
 * trigger on close, and Tab cycles within the dialog.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'sm',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'sm' | 'md';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Move focus into the dialog, preferring the first non-destructive control.
    const target =
      panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') ??
      panelRef.current?.querySelector<HTMLElement>(
        'input, select, textarea, button:not([data-destructive])',
      ) ??
      panelRef.current;

    target?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-[2px] animate-fade-in sm:items-center"
      onMouseDown={(event) => {
        // Only a click that starts on the backdrop closes the dialog, so a drag
        // that ends outside does not dismiss it.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          'w-full rounded-xl border border-line bg-surface shadow-pop animate-slide-up',
          width === 'sm' ? 'max-w-md' : 'max-w-lg',
        )}
      >
        <div className="px-5 pb-1 pt-5">
          <h2 id="dialog-title" className="text-base font-semibold tracking-tight text-ink">
            {title}
          </h2>
          {description ? <div className="mt-1.5 text-sm text-ink-muted">{description}</div> : null}
        </div>

        {children ? <div className="px-5 py-4">{children}</div> : <div className="h-2" />}

        <div className="flex justify-end gap-2 rounded-b-xl border-t border-line bg-canvas/60 px-5 py-3.5">
          {footer ?? (
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** A confirmation dialog for destructive actions. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Delete',
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  loading?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={loading ? () => undefined : onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading} data-autofocus>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading} data-destructive>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
