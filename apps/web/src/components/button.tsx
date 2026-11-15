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
    'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-not-allowed disabled:opacity-50';
  const variantClass =
    variant === 'primary'
      ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
      : 'border border-slate-700 text-slate-200 hover:bg-slate-800';

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
