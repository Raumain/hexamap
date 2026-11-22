import { Link } from '@tanstack/react-router';
import { NOT_FOUND } from '../../content/not-found';

const actionClass =
  'mt-8 inline-flex min-h-11 items-center justify-center rounded-[2px] bg-brass px-5 font-mono text-[11px] uppercase tracking-[0.14em] text-cabinet shadow-brass transition-colors duration-150 hover:bg-brass-pale';

/**
 * Une salle qui n'existe pas, dans le vocabulaire du cabinet.
 *
 * Aucun état, aucune requête : ce composant ne dépend que du routeur, donc il
 * s'affiche aussi vite pour une URL inconnue que pour un `throw notFound()` levé
 * par une route éteinte (la boutique, les pages légales).
 *
 * **Pas de coquille ici.** Le routeur monte ce composant *à l'intérieur* de la
 * route qui gère le défaut ; sur la racine, c'est le `<Outlet/>` d'`AppShell`.
 * Ré-emballer la coquille produisait deux `<main>` imbriqués, deux rails et
 * deux barres d'onglets — mesuré par `packages/e2e/tests/not-found.spec.ts`.
 */
export function NotFound() {
  return (
    <section className="mx-auto max-w-[54ch] py-12 text-center md:py-20">
      <p className="salon-eyebrow">{NOT_FOUND.eyebrow}</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-vellum md:text-5xl">
        {NOT_FOUND.title}
      </h1>
      <div className="brass-rule mx-auto mt-5 w-24" />
      <p className="mt-4 text-[15px] leading-relaxed text-vellum/70">{NOT_FOUND.subtitle}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-vellum/55">{NOT_FOUND.hint}</p>
      <Link to="/" className={actionClass}>
        {NOT_FOUND.action}
      </Link>
    </section>
  );
}
