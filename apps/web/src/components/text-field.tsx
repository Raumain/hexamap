import { type InputHTMLAttributes, useId } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  /** `paper` (par défaut) sur une feuille de vélin, `dark` sur la pièce. */
  tone?: 'paper' | 'dark';
}

export function TextField({
  label,
  error,
  required,
  id,
  className,
  tone = 'paper',
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  const dark = tone === 'dark';

  const inputClass = [
    'mt-1.5 h-11 w-full rounded-[2px] border px-3 text-[15px] outline-none transition-colors duration-150 focus:border-brass focus:ring-2 focus:ring-brass/25',
    dark ? 'bg-cabinet-sunk text-vellum placeholder:text-vellum/55' : 'bg-vellum-2/50 text-ink',
    error ? 'border-danger' : dark ? 'border-veil' : 'border-vellum-edge',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      <label
        htmlFor={fieldId}
        className={`block font-mono text-[10px] uppercase tracking-[0.18em] ${
          dark ? 'text-vellum/65' : 'text-ink-faint'
        }`}
      >
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="text-oxide">
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
        <p id={errorId} className="mt-1.5 font-mono text-[11px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
