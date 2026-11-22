import { createFileRoute, redirect } from '@tanstack/react-router';

/** Ancienne salle de l'Assemblage : renommée L'Atlas en phase 35. La redirection conserve la recherche. */
export const Route = createFileRoute('/assemblage')({
  beforeLoad: () => {
    throw redirect({ to: '/atlas', search: true, replace: true });
  },
});
