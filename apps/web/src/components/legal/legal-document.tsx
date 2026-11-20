import { LEGAL_BANNER, type LegalDocument } from '../../content/legal';

/**
 * Rend un document légal provisoire : bandeau visible, puis une section par
 * repère. Aucun texte juridique n'est inventé ici — chaque paragraphe est un
 * espace réservé que le titulaire du site remplace.
 */
export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  return (
    <section>
      <p
        role="note"
        className="inline-flex max-w-full rounded-[2px] border border-danger/40 bg-cabinet-sunk px-3 py-2 font-mono text-[10px] leading-relaxed tracking-[0.12em] uppercase text-danger"
      >
        {LEGAL_BANNER}
      </p>

      <header className="mt-6">
        <p className="salon-eyebrow">{document.eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-vellum md:text-5xl">
          {document.title}
        </h1>
        <div className="brass-rule mt-5 w-24" />
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-vellum/70">
          {document.subtitle}
        </p>
      </header>

      <div className="mt-8 space-y-6">
        {document.segments.map((segment) => (
          <article
            key={segment.heading}
            className="rounded-sheet border border-veil bg-cabinet-raised px-4 py-5"
          >
            <h2 className="font-display text-lg font-semibold text-vellum">{segment.heading}</h2>
            <p className="mt-2 font-mono text-[11px] leading-relaxed break-words text-vellum/60">
              {segment.placeholder}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
