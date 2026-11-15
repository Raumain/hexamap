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
    'w-full rounded-md border bg-slate-900 px-3 py-2 text-sm text-slate-100',
    'placeholder:text-slate-500 focus:outline-none focus:ring-1',
    error
      ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500'
      : 'border-slate-700 focus:border-amber-400 focus:ring-amber-400',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-1">
      <label htmlFor={fieldId} className="block text-sm font-medium text-slate-200">
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="text-amber-400">
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
        <p id={errorId} className="text-sm text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
