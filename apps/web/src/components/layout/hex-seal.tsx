interface HexSealProps {
  size?: number;
  className?: string;
}

/** Le sceau du cabinet : un hexagone gravé, jamais un logo d'application. */
export function HexSeal({ size = 30, className = '' }: HexSealProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
    >
      <path
        d="M20 2.5 35.2 11.2v17.6L20 37.5 4.8 28.8V11.2z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M20 7.5 30.6 13.7v12.6L20 32.5 9.4 26.3V13.7z"
        stroke="currentColor"
        strokeWidth="0.7"
        opacity="0.55"
      />
      <path d="M20 12.5v15M13.5 20h13" stroke="currentColor" strokeWidth="0.7" opacity="0.75" />
      <circle cx="20" cy="20" r="2.4" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  );
}
