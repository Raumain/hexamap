import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isPending?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brass text-cabinet shadow-brass hover:bg-brass-pale',
  secondary: 'border border-brass/45 text-brass hover:bg-brass/10',
  ghost: 'text-vellum/65 hover:text-vellum',
  danger: 'border border-oxide/60 text-oxide hover:bg-oxide/10',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3',
  md: 'px-5',
};

const BASE_CLASS =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[2px] font-mono text-[11px] uppercase tracking-[0.14em] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40';

export function Button({
  variant = 'primary',
  size = 'md',
  isPending = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isPending;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={isPending || undefined}
      className={`${BASE_CLASS} ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className ?? ''}`.trim()}
      {...props}
    >
      {isPending ? 'Envoi…' : children}
    </button>
  );
}
