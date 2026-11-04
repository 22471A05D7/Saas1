'use client';

import { forwardRef, useId, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/format';

const CONTROL_BASE =
  'block w-full rounded-lg border bg-surface px-3 text-sm text-ink shadow-sm transition-colors ' +
  'placeholder:text-ink-subtle disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-subtle';

function controlClasses(invalid: boolean, extra?: string) {
  return cn(
    CONTROL_BASE,
    invalid
      ? 'border-danger-600/60 focus:border-danger-600'
      : 'border-line hover:border-ink-subtle/60 focus:border-brand-500',
    extra,
  );
}

/**
 * Wraps a control with its label, optional hint, and error message, and wires
 * up the `id`/`aria-describedby`/`aria-invalid` relationships so screen readers
 * announce validation failures.
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
        {required ? <span className="ml-0.5 text-danger-600">*</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-[13px] text-danger-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-[13px] text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, error, hint, className, id, required, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={required}>
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={controlClasses(Boolean(error), cn('h-10', className))}
        {...props}
      />
    </Field>
  );
});

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, error, hint, className, id, required, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={required}>
      <textarea
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={controlClasses(Boolean(error), cn('min-h-[88px] resize-y py-2', className))}
        {...props}
      />
    </Field>
  );
});

export interface SelectInputProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
  /** Renders the label for screen readers only — for toolbar selects. */
  hideLabel?: boolean;
}

export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(function SelectInput(
  { label, error, hint, className, id, children, hideLabel, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const select = (
    <select
      ref={ref}
      id={inputId}
      aria-invalid={error ? true : undefined}
      aria-label={hideLabel ? label : undefined}
      className={controlClasses(Boolean(error), cn('h-10 cursor-pointer pr-8', className))}
      {...props}
    >
      {children}
    </select>
  );

  if (hideLabel) return select;

  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint}>
      {select}
    </Field>
  );
});
