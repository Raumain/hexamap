import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost';
  isPending?: boolean;
}

export function Button({
  variant = 'primary',
  isPending = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const baseClass =
    'inline-flex items-center justify-center rounded-sm px-4 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sign-blue disabled:cursor-not-allowed disabled:opacity-60';
  const variantClass =
    variant === 'primary'
      ? 'border-2 border-border bg-sign-blue text-ink-inverse shadow-tactile-sm hover:shadow-tactile'
      : 'border-2 border-border bg-surface text-ink shadow-tactile-sm hover:bg-muted';

  const isDisabled = disabled || isPending;

  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-busy={isPending || undefined}
      className={`${baseClass} ${variantClass} ${className ?? ''}`.trim()}
      {...props}
    >
      {isPending ? 'Envoi…' : children}
    </button>
  );
}
