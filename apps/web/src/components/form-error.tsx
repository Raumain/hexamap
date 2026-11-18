interface FormErrorProps {
  message?: string | null;
}

export function FormError({ message }: FormErrorProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="rounded-md border border-sign-red/40 bg-sign-red/10 px-4 py-3 text-sm text-sign-red"
    >
      {message}
    </div>
  );
}
