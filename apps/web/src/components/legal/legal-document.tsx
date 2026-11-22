import type { LegalDocument } from '../../content/legal';

/**
 * Rend un document légal : un en-tête, puis une section par entrée. Aucun
 * bandeau provisoire : le document publié est celui qui engage l'éditeur.
 */
export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  return (
    <section>
      <header>
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
            {segment.paragraphs.map((paragraph) => (
              <p
                key={paragraph}
                className="mt-2 font-mono text-[11px] leading-relaxed break-words text-vellum/60"
              >
                {paragraph}
              </p>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}
