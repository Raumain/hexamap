import { RARITY_LABELS } from '@hexamap/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, Navigate, useRouter } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { FormError } from '../components/form-error';
import { TextField } from '../components/text-field';
import { outlineButtonClass, primaryButtonClass } from '../components/ui/button-classes';
import { Card } from '../components/ui/Card';
import { RaritySeal } from '../components/ui/rarity-seal';
import { CARD_DETAIL, CARD_SOURCE_LABELS, stateLabel } from '../content/card-detail';
import { CURRENCY } from '../content/market';
import { CATEGORY_LABELS } from '../content/tickets';
import {
  type CardDetail,
  cardDetailErrorMessage,
  cardDetailQueryKey,
  cardDetailQueryOptions,
} from '../lib/card-detail';
import { collectionQueryKey } from '../lib/collection';
import {
  buyListing,
  createListing,
  marketErrorMessage,
  marketListingsQueryKey,
  myListingsQueryKey,
} from '../lib/market';
import { sessionQueryKey, useSession } from '../lib/session';
import { tableauxListQueryKey } from '../lib/tableaux';
import { collectionStatsQueryKey } from '../lib/tickets';

const scoreFormatter = new Intl.NumberFormat('fr-FR');
const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const coordinateFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

export const Route = createFileRoute('/card/$cardId')({
  component: CardDetailPage,
});

function CardDetailPage() {
  const { cardId } = Route.useParams();
  const session = useSession();

  if (session.isPending) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/70">
        {CARD_DETAIL.loadingSession}
      </p>
    );
  }

  if (!session.data?.user) {
    return <Navigate to="/login" />;
  }

  return <CardDetailView cardId={cardId} viewerId={session.data.user.id} />;
}

interface CardDetailViewProps {
  cardId: string;
  viewerId: string;
}

function CardDetailView({ cardId, viewerId }: CardDetailViewProps) {
  const router = useRouter();
  const detailQuery = useQuery(cardDetailQueryOptions(cardId));

  if (detailQuery.isPending) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/70">
        {CARD_DETAIL.loading}
      </p>
    );
  }

  if (detailQuery.isError) {
    return (
      <section className="space-y-5 rounded-sheet border border-veil bg-cabinet-raised p-6 md:p-8">
        <p role="alert" className="font-display text-lg text-vellum">
          {cardDetailErrorMessage(detailQuery.error)}
        </p>
        <button
          type="button"
          onClick={() => void detailQuery.refetch()}
          className={outlineButtonClass}
        >
          {CARD_DETAIL.retry}
        </button>
      </section>
    );
  }

  const card = detailQuery.data;
  const isOwn = card.owner.id === viewerId;

  return (
    <section className="space-y-10">
      <header>
        <div className="flex items-start justify-between gap-4">
          <p className="salon-eyebrow">{CARD_DETAIL.eyebrow}</p>
          <button
            type="button"
            onClick={() => router.history.back()}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/65 transition-colors duration-150 hover:text-brass"
          >
            <span aria-hidden="true">←</span> {CARD_DETAIL.back}
          </button>
        </div>

        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-vellum md:text-5xl">
          {card.nom}
        </h1>
        <div className="brass-rule mt-5 w-24" />
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-vellum/70">
          {CATEGORY_LABELS[card.category]} · {RARITY_LABELS[card.rarity]} ·{' '}
          {scoreFormatter.format(card.score)} pts
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="lg:sticky lg:top-8 lg:self-start">
          <CardMount card={card} />
        </div>

        <div className="min-w-0 space-y-6">
          <CartelSheet card={card} />
          <PlaceSheet card={card} />
          <ReservesSheet />
          <OfferSheet card={card} isOwn={isOwn} />
        </div>
      </div>

      <div>
        <Link
          to="/collection"
          className="inline-flex min-h-11 items-center font-mono text-[10px] uppercase tracking-[0.18em] text-brass transition-colors duration-150 hover:text-brass-pale"
        >
          {CARD_DETAIL.goCollection}
        </Link>
      </div>
    </section>
  );
}

function CardMount({ card }: { card: CardDetail }) {
  return (
    <div className="relative overflow-hidden rounded-sheet border border-veil bg-cabinet-raised p-5 sm:p-8 md:p-10">
      <div aria-hidden="true" className="light-cone pointer-events-none absolute inset-0" />
      <div className="enter-plate relative mx-auto w-full max-w-[260px] sm:max-w-[300px] lg:max-w-[340px] xl:max-w-[380px]">
        <Card
          type={card.category}
          rarity={card.rarity}
          name={card.nom}
          score={card.score}
          refCode={card.refCode}
          population={card.detail.population}
          occurrenceCount={card.detail.nbCommunes}
          departementName={card.detail.nomDepartement}
          regionName={card.detail.nomRegion}
          blasonUrl={card.blasonUrl}
          blasonCredit={card.blasonCredit}
          locked={card.locked}
          variant="detailed"
        />
      </div>
      <div className="relative mt-6 flex items-center justify-center gap-3">
        <div aria-hidden="true" className="brass-rule w-10 opacity-60" />
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-brass">{card.refCode}</p>
        <div aria-hidden="true" className="brass-rule w-10 opacity-60" />
      </div>
      {card.blasonCredit ? (
        <p className="relative mt-3 text-center font-mono text-[9px] leading-relaxed text-vellum/55">
          {card.blasonCredit}
        </p>
      ) : null}
    </div>
  );
}

function CartelRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

function CartelSheet({ card }: { card: CardDetail }) {
  return (
    <section className="vellum rounded-sheet p-6 md:p-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass-deep">
        {CARD_DETAIL.cartelTitle}
      </p>

      <dl className="mt-5 divide-y divide-ink/12">
        <CartelRow label={CARD_DETAIL.categoryLabel}>
          <span className="text-[15px] text-ink">{CATEGORY_LABELS[card.category]}</span>
        </CartelRow>

        <CartelRow label={CARD_DETAIL.rarityLabel}>
          <span className="inline-flex items-baseline gap-2">
            <RaritySeal rarity={card.rarity} size={20} />
            <span className="text-[15px] text-ink">{RARITY_LABELS[card.rarity]}</span>
          </span>
        </CartelRow>

        <CartelRow label={CARD_DETAIL.scoreLabel}>
          <span className="font-display text-3xl tabular-nums text-ink">
            {scoreFormatter.format(card.score)}
          </span>
        </CartelRow>

        <CartelRow label={CARD_DETAIL.refLabel}>
          <span className="font-mono text-[13px] tabular-nums text-ink-soft">{card.refCode}</span>
        </CartelRow>

        <CartelRow label={CARD_DETAIL.acquiredLabel}>
          <span className="font-mono text-[12px] tabular-nums text-ink-soft">
            {dateFormatter.format(new Date(card.acquiredAt))}
          </span>
        </CartelRow>

        <CartelRow label={CARD_DETAIL.sourceLabel}>
          <span className="text-[14px] text-ink-soft">{CARD_SOURCE_LABELS[card.source]}</span>
        </CartelRow>

        <CartelRow label={CARD_DETAIL.stateLabel}>
          <span className="text-[14px] text-ink-soft">
            {stateLabel(card.locked, card.listing !== null)}
          </span>
        </CartelRow>
      </dl>
    </section>
  );
}

interface PlaceBlock {
  label: string;
  value: string;
}

function placeBlocks(card: CardDetail): PlaceBlock[] {
  const { detail } = card;
  const blocks: PlaceBlock[] = [];

  if (detail.population !== null) {
    blocks.push({
      label: CARD_DETAIL.populationLabel,
      value: `${scoreFormatter.format(detail.population)} hab.`,
    });
  }

  if (detail.codeDepartement !== null || detail.nomDepartement !== null) {
    const nom = detail.nomDepartement ?? detail.codeDepartement ?? '—';
    const code = detail.nomDepartement !== null ? detail.codeDepartement : null;
    blocks.push({
      label: CARD_DETAIL.departementLabel,
      value: code === null || code === nom ? nom : `${nom} (${code})`,
    });
  }

  if (detail.nomRegion !== null) {
    blocks.push({ label: CARD_DETAIL.regionLabel, value: detail.nomRegion });
  }

  if (card.category === 'RUE' && detail.nbCommunes !== null) {
    const count = scoreFormatter.format(detail.nbCommunes);
    blocks.push({
      label: CARD_DETAIL.occurrencesLabel,
      value: detail.nbCommunes === 1 ? `${count} commune` : `${count} communes`,
    });
  }

  if (detail.latitude !== null && detail.longitude !== null) {
    blocks.push({
      label: CARD_DETAIL.coordinatesLabel,
      value: `${coordinateFormatter.format(detail.latitude)}°, ${coordinateFormatter.format(detail.longitude)}°`,
    });
  }

  return blocks;
}

function PlaceSheet({ card }: { card: CardDetail }) {
  const blocks = placeBlocks(card);

  return (
    <section className="rounded-sheet border border-veil bg-cabinet-raised p-6 md:p-7">
      <h2 className="font-display text-xl text-vellum">{CARD_DETAIL.placeTitle}</h2>

      {blocks.length === 0 ? (
        <p className="mt-4 font-display italic text-vellum/60">{CARD_DETAIL.placeEmpty}</p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {blocks.map((block) => (
            <div key={block.label} className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-vellum/60">
                {block.label}
              </p>
              <p className="mt-1 font-mono text-[13px] tabular-nums text-vellum">{block.value}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const RESERVES = [
  CARD_DETAIL.reserveMarket,
  CARD_DETAIL.reserveHolders,
  CARD_DETAIL.reserveChronicle,
] as const;

function ReservesSheet() {
  return (
    <section className="border-t border-veil pt-6">
      <h2 className="font-display text-xl text-vellum">{CARD_DETAIL.reservesTitle}</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-vellum/60">{CARD_DETAIL.reservesHint}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {RESERVES.map((label) => (
          <div
            key={label}
            className="flex flex-col justify-between gap-3 rounded-[2px] border border-dashed border-veil-strong/60 p-4"
          >
            <p className="font-display text-[15px] text-vellum/75">{label}</p>
            <span className="inline-flex w-fit items-center rounded-full border border-brass/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-brass/70">
              {CARD_DETAIL.reservePending}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

interface OfferSheetProps {
  card: CardDetail;
  isOwn: boolean;
}

function OfferSheet({ card, isOwn }: OfferSheetProps) {
  const [justListed, setJustListed] = useState(false);
  const listing = card.listing;

  if (isOwn) {
    return (
      <div className="space-y-4">
        {justListed ? (
          <p
            role="status"
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-verdigris"
          >
            {CARD_DETAIL.marketSuccess}
          </p>
        ) : null}

        {listing && listing.status === 'OPEN' ? (
          <ListedPanel card={card} listing={listing} />
        ) : card.locked ? (
          <LockedPanel />
        ) : (
          <SellForm card={card} onListed={() => setJustListed(true)} />
        )}
      </div>
    );
  }

  if (listing && listing.status === 'OPEN') {
    return <BuyPanel card={card} listing={listing} />;
  }

  return null;
}

function SellForm({ card, onListed }: { card: CardDetail; onListed: () => void }) {
  const queryClient = useQueryClient();
  const [price, setPrice] = useState('');

  const parsedPrice = price === '' ? Number.NaN : Number.parseInt(price, 10);
  const priceValid = Number.isInteger(parsedPrice) && parsedPrice >= 1 && parsedPrice <= 1_000_000;
  const priceError = price !== '' && !priceValid ? CARD_DETAIL.marketPriceInvalid : null;

  const createMutation = useMutation({
    mutationFn: createListing,
    onSuccess: () => {
      setPrice('');
      onListed();
      void queryClient.invalidateQueries({ queryKey: myListingsQueryKey });
      void queryClient.invalidateQueries({ queryKey: marketListingsQueryKey });
      void queryClient.invalidateQueries({ queryKey: collectionQueryKey });
      void queryClient.invalidateQueries({ queryKey: collectionStatsQueryKey });
      void queryClient.invalidateQueries({ queryKey: tableauxListQueryKey });
      void queryClient.invalidateQueries({ queryKey: cardDetailQueryKey(card.id) });
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!priceValid) return;
        createMutation.mutate({ userCardId: card.id, price: parsedPrice });
      }}
      className="space-y-5 rounded-sheet border border-brass/30 bg-cabinet-raised p-6 md:p-7"
    >
      <h2 className="font-display text-xl text-vellum">{CARD_DETAIL.marketTitle}</h2>

      <TextField
        tone="dark"
        label={CARD_DETAIL.marketPriceLabel}
        inputMode="numeric"
        type="number"
        min={1}
        step={1}
        placeholder={CARD_DETAIL.marketPricePlaceholder}
        value={price}
        error={priceError ?? undefined}
        onChange={(event) => setPrice(event.target.value)}
      />

      <FormError message={createMutation.error ? marketErrorMessage(createMutation.error) : null} />

      <button
        type="submit"
        disabled={!priceValid || createMutation.isPending}
        aria-busy={createMutation.isPending || undefined}
        className={primaryButtonClass}
      >
        {createMutation.isPending ? CARD_DETAIL.marketPending : CARD_DETAIL.marketSubmit}
      </button>
    </form>
  );
}

function ListedPanel({
  card,
  listing,
}: {
  card: CardDetail;
  listing: NonNullable<CardDetail['listing']>;
}) {
  return (
    <section className="space-y-4 rounded-sheet border border-brass/30 bg-cabinet-raised p-6 md:p-7">
      <h2 className="font-display text-xl text-vellum">{CARD_DETAIL.listedTitle}</h2>

      <p className="flex items-baseline gap-2">
        <span className="font-display text-3xl tabular-nums text-brass">
          {scoreFormatter.format(listing.price)}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/60">
          {CURRENCY.unit}
        </span>
      </p>

      <p className="font-mono text-[10px] tabular-nums text-vellum/55">
        {dateFormatter.format(new Date(listing.createdAt))}
      </p>

      <Link
        to="/market/mine"
        aria-label={`${CARD_DETAIL.listedManage} — ${card.nom}`}
        className={outlineButtonClass}
      >
        {CARD_DETAIL.listedManage}
      </Link>
    </section>
  );
}

function LockedPanel() {
  return (
    <section className="space-y-3 rounded-sheet border border-brass/30 bg-cabinet-raised p-6 md:p-7">
      <h2 className="font-display text-xl text-vellum">{CARD_DETAIL.lockedTitle}</h2>
      <p className="text-[13px] leading-relaxed text-vellum/65">{CARD_DETAIL.lockedHint}</p>
    </section>
  );
}

function BuyPanel({
  card,
  listing,
}: {
  card: CardDetail;
  listing: NonNullable<CardDetail['listing']>;
}) {
  const viewer = useSession();
  const viewerId = viewer.data?.user?.id ?? null;
  const queryClient = useQueryClient();

  const buyMutation = useMutation({
    mutationFn: buyListing,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: marketListingsQueryKey });
      void queryClient.invalidateQueries({ queryKey: myListingsQueryKey });
      void queryClient.invalidateQueries({ queryKey: collectionQueryKey });
      void queryClient.invalidateQueries({ queryKey: collectionStatsQueryKey });
      void queryClient.invalidateQueries({ queryKey: tableauxListQueryKey });
      void queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      void queryClient.invalidateQueries({ queryKey: cardDetailQueryKey(card.id) });
    },
  });

  return (
    <section className="space-y-4 rounded-sheet border border-brass/30 bg-cabinet-raised p-6 md:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-xl text-vellum">{CARD_DETAIL.listedTitle}</h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/60">
          {CARD_DETAIL.sellerLabel} ·{' '}
          {viewerId && card.owner.id !== viewerId ? (
            <Link
              to="/players/$playerId"
              params={{ playerId: card.owner.id }}
              aria-label={`Voir la vitrine de ${card.owner.pseudo ?? CARD_DETAIL.anonymous}`}
              className="text-brass underline underline-offset-4 transition-colors duration-150 hover:text-brass-pale"
            >
              {card.owner.pseudo ?? CARD_DETAIL.anonymous}
            </Link>
          ) : (
            (card.owner.pseudo ?? CARD_DETAIL.anonymous)
          )}
        </p>
      </div>

      <p className="flex items-baseline gap-2">
        <span className="font-display text-3xl tabular-nums text-brass">
          {scoreFormatter.format(listing.price)}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/60">
          {CURRENCY.unit}
        </span>
      </p>

      <FormError message={buyMutation.error ? marketErrorMessage(buyMutation.error) : null} />

      <button
        type="button"
        onClick={() => buyMutation.mutate(listing.id)}
        disabled={buyMutation.isPending}
        aria-busy={buyMutation.isPending || undefined}
        aria-label={`${CARD_DETAIL.buy} — ${card.nom}`}
        className={primaryButtonClass}
      >
        {buyMutation.isPending ? CARD_DETAIL.buying : CARD_DETAIL.buy}
      </button>
    </section>
  );
}
