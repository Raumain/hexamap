import { createFileRoute, Link } from '@tanstack/react-router';
import { ASSEMBLAGE_ROOM } from '../content/assemblage';
import { FRANCE_CORSICA_PATH, FRANCE_MAINLAND_PATH, FRANCE_VIEWBOX } from '../lib/france-outline';

export const Route = createFileRoute('/assemblage')({
  component: AssemblagePage,
});

const ctaClass =
  'inline-flex min-h-11 items-center justify-center rounded-[2px] border border-brass/50 px-4 font-mono text-[10px] uppercase tracking-[0.14em] text-brass transition-colors duration-150 hover:border-brass hover:text-brass-pale';

const MAP_LABEL = 'Carte de France, encore vide';

function AssemblagePage() {
  return (
    <section>
      <header>
        <p className="salon-eyebrow">{ASSEMBLAGE_ROOM.eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-vellum md:text-5xl">
          {ASSEMBLAGE_ROOM.title}
        </h1>
        <div className="brass-rule mt-5 w-24" />
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-vellum/70">
          {ASSEMBLAGE_ROOM.subtitle}
        </p>
      </header>

      <div className="mt-8 space-y-10">
        <div className="space-y-3">
          <p className="inline-flex items-center rounded-[2px] border border-brass/50 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-brass">
            {ASSEMBLAGE_ROOM.status}
          </p>
          <p className="max-w-2xl text-sm leading-relaxed text-vellum/60">
            {ASSEMBLAGE_ROOM.statusDetail}
          </p>
        </div>

        <figure className="rounded-[2px] border border-veil bg-cabinet-sunk p-4 md:p-8">
          <svg
            viewBox={FRANCE_VIEWBOX}
            className="h-auto w-full text-brass/45"
            role="img"
            aria-label={MAP_LABEL}
          >
            <title>{MAP_LABEL}</title>
            {/* `role="img"` rend déjà les descendants décoratifs : un `aria-hidden`
                sur les tracés est signalé par `lint/a11y/noAriaHiddenOnFocusable`. */}
            <g fill="none" stroke="currentColor" strokeWidth={1} strokeLinejoin="round">
              <path d={FRANCE_MAINLAND_PATH} />
              <path d={FRANCE_CORSICA_PATH} />
            </g>
          </svg>
          <figcaption className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/50">
            {ASSEMBLAGE_ROOM.previewLegend}
          </figcaption>
        </figure>

        <div>
          <h2 className="salon-eyebrow">{ASSEMBLAGE_ROOM.layersTitle}</h2>
          <dl className="mt-4 divide-y divide-veil rounded-sheet border border-veil bg-cabinet-raised">
            <div className="flex flex-col gap-1 p-4">
              <dt className="text-vellum">{ASSEMBLAGE_ROOM.layerRegion}</dt>
              <dd className="text-sm text-vellum/70">{ASSEMBLAGE_ROOM.layerRegionDetail}</dd>
            </div>
            <div className="flex flex-col gap-1 p-4">
              <dt className="text-vellum">{ASSEMBLAGE_ROOM.layerDepartement}</dt>
              <dd className="text-sm text-vellum/70">{ASSEMBLAGE_ROOM.layerDepartementDetail}</dd>
            </div>
            <div className="flex flex-col gap-1 p-4">
              <dt className="text-vellum">{ASSEMBLAGE_ROOM.layerCommune}</dt>
              <dd className="text-sm text-vellum/70">{ASSEMBLAGE_ROOM.layerCommuneDetail}</dd>
            </div>
            <div className="flex flex-col gap-1 p-4">
              <dt className="text-vellum/50">{ASSEMBLAGE_ROOM.layerRue}</dt>
              <dd className="text-sm text-vellum/50">{ASSEMBLAGE_ROOM.layerRueDetail}</dd>
            </div>
          </dl>
        </div>

        <p className="border-l border-brass/30 pl-4 text-[13px] leading-relaxed text-vellum/55">
          {ASSEMBLAGE_ROOM.footnote}
        </p>

        <Link to="/collection" className={ctaClass}>
          {ASSEMBLAGE_ROOM.cta}
        </Link>
      </div>
    </section>
  );
}
