import type { Category, Rarity } from '@hexamap/shared';
import { RARITY, RARITY_LABELS, RARITY_WEIGHTS } from '@hexamap/shared';
import { createFileRoute, Link } from '@tanstack/react-router';
import { HexSeal } from '../components/layout/hex-seal';
import { Card } from '../components/ui/Card';
import { RaritySeal } from '../components/ui/rarity-seal';
import { HOME_PAGE } from '../content/home';
import { LEGAL_LINKS, LEGAL_PAGES_ENABLED } from '../content/legal';

export const Route = createFileRoute('/home')({
  component: HomePage,
});

const WEIGHT_FORMAT = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const CATEGORY_RARITY: Record<Category, Rarity> = {
  REGION: 'RARE',
  DEPARTEMENT: 'EPIQUE',
  COMMUNE: 'INHABITUELLE',
  RUE: 'LEGENDAIRE',
};

const PRIMARY_CTA =
  'inline-flex min-h-11 items-center justify-center rounded-[2px] bg-brass px-5 font-mono text-[11px] uppercase tracking-[0.14em] text-cabinet shadow-brass transition-colors duration-150 hover:bg-brass-pale';

/** La planche d'exemple d'une catégorie : aucune donnée inventée deux fois. */
function plateFor(type: Category) {
  switch (type) {
    case 'REGION':
      return HOME_PAGE.heroPlates[0];
    case 'DEPARTEMENT':
      return HOME_PAGE.heroPlates[1];
    case 'COMMUNE':
      return HOME_PAGE.heroPlates[2];
    case 'RUE':
      return HOME_PAGE.heroPlates[3];
  }
}

function HomeHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-veil bg-cabinet/90 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
      <div className="gutter-safe mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/home" className="flex min-w-0 items-center gap-2.5">
            <HexSeal size={26} className="text-brass" />
            <span className="truncate font-display text-lg font-semibold leading-none text-vellum">
              {HOME_PAGE.brand}
            </span>
          </Link>
          <span className="salon-eyebrow hidden truncate sm:inline">{HOME_PAGE.brandTagline}</span>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-veil/60">
      <div aria-hidden="true" className="light-cone pointer-events-none absolute inset-0" />

      <div className="gutter-safe relative mx-auto grid w-full max-w-6xl items-center gap-10 py-16 md:py-24 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="salon-eyebrow">{HOME_PAGE.eyebrow}</p>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-vellum sm:text-5xl lg:text-6xl">
            {HOME_PAGE.title}
          </h1>
          <div className="brass-rule mt-6 w-24" />
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-vellum/70">
            {HOME_PAGE.subtitle}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/" className={PRIMARY_CTA}>
              {HOME_PAGE.primaryCta}
            </Link>
          </div>

          <p className="mt-6 max-w-md font-mono text-[10px] leading-relaxed text-vellum/45">
            {HOME_PAGE.heroCaption}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-5">
          {HOME_PAGE.heroPlates.map((plate, index) => (
            <div
              key={plate.name}
              className={`enter-plate w-full${index % 2 === 1 ? ' md:mt-10' : ''}`}
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <Card
                type={plate.type}
                rarity={plate.rarity}
                name={plate.name}
                score={plate.score}
                refCode={plate.refCode}
                blasonUrl={plate.blasonUrl}
                className="w-full"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Gesture() {
  return (
    <section className="gutter-safe mx-auto w-full max-w-6xl py-16 md:py-20">
      <p className="salon-eyebrow">{HOME_PAGE.gestureEyebrow}</p>
      <h2 className="mt-3 font-display text-3xl font-semibold text-vellum md:text-4xl">
        {HOME_PAGE.gestureTitle}
      </h2>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-vellum/65">
        {HOME_PAGE.gestureSubtitle}
      </p>

      <ol className="mt-8 grid gap-4 sm:grid-cols-2">
        {HOME_PAGE.gestureSteps.map((step, index) => (
          <li key={step.title} className="rounded-sheet border border-veil bg-cabinet-raised p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brass">
              {String(index + 1).padStart(2, '0')}
            </p>
            <h3 className="mt-3 font-display text-lg font-semibold text-vellum">{step.title}</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-vellum/65">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Categories() {
  return (
    <section className="gutter-safe mx-auto w-full max-w-6xl pb-16 md:pb-20">
      <p className="salon-eyebrow">{HOME_PAGE.categoriesEyebrow}</p>
      <h2 className="mt-3 font-display text-3xl font-semibold text-vellum md:text-4xl">
        {HOME_PAGE.categoriesTitle}
      </h2>

      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {HOME_PAGE.categories.map((item) => {
          const plate = plateFor(item.type);

          return (
            <li key={item.type} className="flex flex-col">
              <div className="w-full max-w-[190px]">
                <Card
                  type={item.type}
                  rarity={CATEGORY_RARITY[item.type]}
                  name={plate.name}
                  score={plate.score}
                  refCode={plate.refCode}
                  blasonUrl={plate.blasonUrl}
                  className="w-full"
                />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-vellum">{item.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-vellum/65">{item.body}</p>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-brass/80">
                {item.detail}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Synergy() {
  return (
    <section className="gutter-safe mx-auto w-full max-w-6xl border-t border-veil/60 py-16 md:py-20">
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <p className="salon-eyebrow">{HOME_PAGE.synergyEyebrow}</p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-vellum md:text-4xl">
            {HOME_PAGE.synergyTitle}
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-vellum/65">
            {HOME_PAGE.synergyBody}
          </p>

          <ul className="mt-6 space-y-3">
            {HOME_PAGE.synergyLinks.map((link) => (
              <li key={link} className="flex items-baseline gap-3 text-sm text-vellum/70">
                <span aria-hidden="true" className="font-mono text-brass">
                  ✓
                </span>
                {link}
              </li>
            ))}
          </ul>

          <p className="mt-6 border-l border-brass/30 pl-4 text-[13px] leading-relaxed text-vellum/55">
            {HOME_PAGE.synergyNote}
          </p>
        </div>

        <dl className="self-start rounded-sheet border border-veil bg-cabinet-sunk">
          {HOME_PAGE.synergyMultipliers.map((tier) => (
            <div
              key={tier.links}
              className="flex items-baseline justify-between border-b border-veil/60 p-4 last:border-b-0"
            >
              <dt className="text-sm text-vellum/70">{tier.links}</dt>
              <dd className="font-mono text-2xl tabular-nums text-brass">{tier.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Metals() {
  return (
    <section className="gutter-safe mx-auto w-full max-w-6xl border-t border-veil/60 py-16 md:py-20">
      <p className="salon-eyebrow">{HOME_PAGE.metalsEyebrow}</p>
      <h2 className="mt-3 font-display text-3xl font-semibold text-vellum md:text-4xl">
        {HOME_PAGE.metalsTitle}
      </h2>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-vellum/65">
        {HOME_PAGE.metalsBody}
      </p>

      <dl className="mt-8 grid overflow-hidden rounded-sheet border border-veil bg-cabinet-raised md:grid-cols-2">
        {RARITY.map((rarity) => (
          <div
            key={rarity}
            className="flex items-center justify-between gap-4 border-b border-veil/60 p-4 last:border-b-0"
          >
            <dt className="flex items-center gap-3 text-sm text-vellum">
              <RaritySeal rarity={rarity} size={22} />
              {RARITY_LABELS[rarity]}
            </dt>
            <dd className="font-mono text-sm tabular-nums text-brass">
              {WEIGHT_FORMAT.format(RARITY_WEIGHTS[rarity])} %
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function HomeFooter() {
  return (
    <footer className="border-t border-veil">
      <div className="gutter-safe mx-auto w-full max-w-6xl py-10">
        <p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-vellum/55">
          <HexSeal size={22} className="text-brass" />
          {HOME_PAGE.brand} · {HOME_PAGE.footerTagline}
        </p>

        {LEGAL_PAGES_ENABLED ? (
          <nav
            className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1"
            aria-label={HOME_PAGE.footerLegalLabel}
          >
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="inline-flex min-h-11 items-center font-mono text-[9px] uppercase tracking-[0.18em] text-vellum/60 transition-colors duration-150 hover:text-brass"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ) : null}

        <p className="mt-3 max-w-2xl font-mono text-[9px] leading-relaxed tracking-[0.14em] text-vellum/35">
          {HOME_PAGE.footerSources}
        </p>

        <Link
          to="/"
          className="mt-4 inline-flex min-h-11 items-center font-mono text-[10px] uppercase tracking-[0.16em] text-brass transition-colors duration-150 hover:text-brass-pale"
        >
          {HOME_PAGE.footerCta}
        </Link>
      </div>
    </footer>
  );
}

function HomePage() {
  return (
    <>
      <HomeHeader />
      <main className="enter-salon">
        <Hero />
        <Gesture />
        <Categories />
        <Synergy />
        <Metals />
      </main>
      <HomeFooter />
    </>
  );
}
