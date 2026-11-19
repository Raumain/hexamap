import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

interface CardLinkProps {
  cardId: string;
  label: string;
  className?: string;
  children: ReactNode;
}

export function cardLinkLabel(cardName: string): string {
  return `Voir la fiche de ${cardName}`;
}

export function CardLink({ cardId, label, className = '', children }: CardLinkProps) {
  return (
    <Link
      to="/card/$cardId"
      params={{ cardId }}
      aria-label={label}
      className={`block rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${className}`}
    >
      {children}
    </Link>
  );
}
