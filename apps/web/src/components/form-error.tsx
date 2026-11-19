interface FormErrorProps {
  message?: string | null;
}

export function FormError({ message }: FormErrorProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="rounded-[2px] border border-danger/45 bg-danger/15 px-3 py-2 font-mono text-[11px] leading-relaxed text-danger"
    >
      {message}
    </div>
  );
}
