import { type InputHTMLAttributes, useId } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function TextField({ label, error, required, id, className, ...props }: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;

  const inputClass = [
    'w-full rounded-sm border-2 bg-surface px-3 py-2 text-sm text-ink',
    'placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sign-blue',
    error ? 'border-sign-red' : 'border-border',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-1">
      <label htmlFor={fieldId} className="block text-sm font-medium text-ink-secondary">
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="text-sign-ochre">
              {' '}
              *
            </span>
            <span className="sr-only">(obligatoire)</span>
          </>
        ) : null}
      </label>
      <input
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-errormessage={error ? errorId : undefined}
        aria-describedby={error ? errorId : undefined}
        className={inputClass}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-sm text-sign-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
