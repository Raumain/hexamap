import {
  COMMUNE_RARITY_BOUNDS,
  COMMUNE_SCORE_EXAMPLES,
  EDITION_SCORE,
  RARITY,
  RARITY_LABELS,
  RARITY_WEIGHTS,
  type Rarity,
  RUE_RARITY_BOUNDS,
  RUE_SCORE_EXAMPLES,
} from '@hexamap/shared';
import { createFileRoute } from '@tanstack/react-router';
import { RaritySeal } from '../components/ui/rarity-seal';
import {
  communesLabel,
  communesRangeLabel,
  pointsLabel,
  populationLabel,
  populationRangeLabel,
  RARETE,
  rueInvertedParagraph,
  weightLabel,
} from '../content/rarete';

export const Route = createFileRoute('/rarete')({
  component: RaretePage,
});

const CARD = 'rounded-sheet border border-veil bg-cabinet-raised px-4 py-5';
const HEADING = 'font-display text-lg font-semibold text-vellum';
const CELL_HEAD = 'pb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-vellum/50';
const CELL_HEAD_END = `${CELL_HEAD} text-right`;
const CELL = 'border-t border-veil/50 py-2 align-middle';
const CELL_END = `${CELL} text-right font-mono text-[12px] tabular-nums text-brass-pale`;
const CELL_TEXT = `${CELL} text-right font-mono text-[12px] text-vellum/70`;

/**
 * Le sceau est décoratif ici : le libellé du palier est écrit juste à côté, donc
 * il porte seul le nom accessible de la ligne. Sans cela, un lecteur d'écran
 * annoncerait « Rareté : Commune, Commune ».
 */
function RarityLabel({ rarity }: { rarity: Rarity }) {
  return (
    <span className="inline-flex items-center gap-2 text-[14px] text-vellum">
      <span aria-hidden="true" className="inline-flex">
        <RaritySeal rarity={rarity} size={16} />
      </span>
      <span>{RARITY_LABELS[rarity]}</span>
    </span>
  );
}

function RaretePage() {
  const totalWeight = RARITY.reduce((sum, rarity) => sum + RARITY_WEIGHTS[rarity], 0);
  const singleCommuneStreet = RUE_SCORE_EXAMPLES.find((example) => example.nbCommunes === 1);
  const widespreadStreet = RUE_SCORE_EXAMPLES.find((example) => example.nbCommunes === 10_000);

  return (
    <section>
      <header>
        <p className="salon-eyebrow">{RARETE.eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-vellum md:text-5xl">
          {RARETE.title}
        </h1>
        <div className="brass-rule mt-5 w-24" />
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-vellum/70">
          {RARETE.subtitle}
        </p>
      </header>

      <div className="mt-8 grid items-start gap-6 md:grid-cols-2">
        <article className={CARD}>
          <h2 className={HEADING}>{RARETE.tiers.heading}</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-vellum/70">{RARETE.tiers.intro}</p>
          <table
            className="mt-3 w-full border-collapse text-left"
            aria-label={RARETE.tiers.heading}
          >
            <thead>
              <tr>
                <th scope="col" className={CELL_HEAD}>
                  {RARETE.tiers.columns.rarity}
                </th>
                <th scope="col" className={CELL_HEAD_END}>
                  {RARETE.tiers.columns.weight}
                </th>
              </tr>
            </thead>
            <tbody>
              {RARITY.map((rarity) => (
                <tr key={rarity}>
                  <th scope="row" className={`${CELL} text-left font-normal`}>
                    <RarityLabel rarity={rarity} />
                  </th>
                  <td className={CELL_END}>{weightLabel(RARITY_WEIGHTS[rarity])}</td>
                </tr>
              ))}
              <tr>
                <th
                  scope="row"
                  className={`${CELL} text-left text-[13px] font-normal text-vellum/60`}
                >
                  {RARETE.tiers.total}
                </th>
                <td className={CELL_END}>{weightLabel(totalWeight)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 font-mono text-[10px] leading-relaxed text-vellum/50">
            {RARETE.tiers.totalNote}
          </p>
        </article>

        <article className={CARD}>
          <h2 className={HEADING}>{RARETE.commune.heading}</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-vellum/70">{RARETE.commune.intro}</p>
          <table
            className="mt-3 w-full border-collapse text-left"
            aria-label={RARETE.commune.heading}
          >
            <thead>
              <tr>
                <th scope="col" className={CELL_HEAD}>
                  {RARETE.commune.columns.rarity}
                </th>
                <th scope="col" className={CELL_HEAD_END}>
                  {RARETE.commune.columns.range}
                </th>
              </tr>
            </thead>
            <tbody>
              {COMMUNE_RARITY_BOUNDS.map((band) => (
                <tr key={band.rarity}>
                  <th scope="row" className={`${CELL} text-left font-normal`}>
                    <RarityLabel rarity={band.rarity} />
                  </th>
                  <td className={CELL_TEXT}>{populationRangeLabel(band.min, band.max)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className={CARD}>
          <h2 className={HEADING}>{RARETE.rue.heading}</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-vellum/70">{RARETE.rue.intro}</p>
          <table className="mt-3 w-full border-collapse text-left" aria-label={RARETE.rue.heading}>
            <thead>
              <tr>
                <th scope="col" className={CELL_HEAD}>
                  {RARETE.rue.columns.rarity}
                </th>
                <th scope="col" className={CELL_HEAD_END}>
                  {RARETE.rue.columns.range}
                </th>
              </tr>
            </thead>
            <tbody>
              {RUE_RARITY_BOUNDS.map((band) => (
                <tr key={band.rarity}>
                  <th scope="row" className={`${CELL} text-left font-normal`}>
                    <RarityLabel rarity={band.rarity} />
                  </th>
                  <td className={CELL_TEXT}>{communesRangeLabel(band.min, band.max)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className={CARD}>
          <h2 className={HEADING}>{RARETE.formulas.heading}</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-vellum/70">{RARETE.formulas.intro}</p>
          <dl className="mt-3 flex flex-col gap-3">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-vellum/50">
                {RARETE.formulas.communeLabel}
              </dt>
              <dd className="mt-1 font-mono text-[15px] text-brass-pale">
                round({RARETE.formulas.communeFormula})
              </dd>
              <dd className="mt-1 text-[12px] leading-relaxed text-vellum/60">
                {RARETE.formulas.communeNote}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-vellum/50">
                {RARETE.formulas.rueLabel}
              </dt>
              <dd className="mt-1 font-mono text-[15px] text-brass-pale">
                round({RARETE.formulas.rueFormula})
              </dd>
              <dd className="mt-1 text-[12px] leading-relaxed text-vellum/60">
                {RARETE.formulas.rueNote}
              </dd>
            </div>
          </dl>
          <p className="mt-3 font-mono text-[10px] leading-relaxed text-vellum/50">
            {RARETE.formulas.rounding}
          </p>
        </article>

        <article className={`${CARD} md:col-span-2`}>
          <h2 className={HEADING}>{RARETE.editions.heading}</h2>
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-vellum/70">
            {RARETE.editions.intro}
          </p>
          <table
            className="mt-3 w-full border-collapse text-left"
            aria-label={RARETE.editions.heading}
          >
            <thead>
              <tr>
                <th scope="col" className={CELL_HEAD}>
                  {RARETE.editions.columns.edition}
                </th>
                <th scope="col" className={CELL_HEAD_END}>
                  {RARETE.editions.columns.score}
                </th>
              </tr>
            </thead>
            <tbody>
              {RARITY.map((rarity) => (
                <tr key={rarity}>
                  <th scope="row" className={`${CELL} text-left font-normal`}>
                    <RarityLabel rarity={rarity} />
                  </th>
                  <td className={CELL_END}>{pointsLabel(EDITION_SCORE[rarity])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-[14px] leading-relaxed text-vellum/80">
            {RARETE.editions.duplicate}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-vellum/60">
            {RARETE.editions.communeContrast}
          </p>
        </article>

        <article className={`${CARD} md:col-span-2`}>
          <h2 className={HEADING}>{RARETE.examples.heading}</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-vellum/70">{RARETE.examples.intro}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-vellum/50">
                {RARETE.examples.communeTitle}
              </h3>
              <ul aria-label={RARETE.examples.communeTitle} className="mt-2 flex flex-col gap-1">
                {COMMUNE_SCORE_EXAMPLES.map((example) => (
                  <li
                    key={example.population}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span className="font-mono text-[11px] tabular-nums text-vellum/70">
                      {populationLabel(example.population)}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-brass-pale">
                      {pointsLabel(example.score)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-vellum/50">
                {RARETE.examples.rueTitle}
              </h3>
              <ul aria-label={RARETE.examples.rueTitle} className="mt-2 flex flex-col gap-1">
                {RUE_SCORE_EXAMPLES.map((example) => (
                  <li
                    key={example.nbCommunes}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span className="font-mono text-[11px] tabular-nums text-vellum/70">
                      {communesLabel(example.nbCommunes)}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-brass-pale">
                      {pointsLabel(example.score)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </article>

        <article className={`${CARD} md:col-span-2`}>
          <h2 className={HEADING}>{RARETE.inverted.heading}</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-vellum/80">
            {singleCommuneStreet && widespreadStreet
              ? rueInvertedParagraph(singleCommuneStreet.score, widespreadStreet.score)
              : RARETE.inverted.fallback}
          </p>
        </article>
      </div>
    </section>
  );
}
