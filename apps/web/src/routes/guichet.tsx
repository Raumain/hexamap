import { isNotificationKind, NOTIFICATION_KINDS } from '@hexamap/shared';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, Navigate } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { FormError } from '../components/form-error';
import { SessionUnavailable } from '../components/ui/session-unavailable';
import { GUICHIET } from '../content/guichet';
import {
  markAllRead,
  markRead,
  type NotificationItem,
  notificationsErrorMessage,
  notificationsInfiniteQueryOptions,
  notificationsQueryKey,
  unreadQueryKey,
} from '../lib/notifications';
import { useSessionState } from '../lib/session';

const PRIMARY_ACTION =
  'inline-flex min-h-[44px] items-center justify-center rounded-[2px] border border-brass-deep bg-brass px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-cabinet shadow-brass transition-colors duration-150 hover:bg-brass-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/60 disabled:cursor-not-allowed disabled:opacity-60';

const SECONDARY_ACTION =
  'inline-flex min-h-[44px] items-center justify-center rounded-[2px] border border-veil px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/70 transition-colors duration-150 hover:border-brass/40 hover:text-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/60 disabled:cursor-not-allowed disabled:opacity-60';

interface Notice {
  tone: 'success' | 'error';
  message: string;
}

export const Route = createFileRoute('/guichet')({
  component: GuichetPage,
});

function GuichetPage() {
  const session = useSessionState();

  return (
    <section className="space-y-10">
      <header>
        <p className="salon-eyebrow">{GUICHIET.eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-vellum md:text-5xl">
          {GUICHIET.title}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-vellum/70">{GUICHIET.subtitle}</p>
        <div className="brass-rule mt-5 w-24" />
      </header>

      {session.status === 'loading' ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/60">
          {GUICHIET.loadingSession}
        </p>
      ) : session.status === 'unavailable' ? (
        <SessionUnavailable onRetry={session.retry} />
      ) : session.status === 'anonymous' ? (
        <Navigate to="/login" />
      ) : (
        <GuichetBody />
      )}
    </section>
  );
}

function GuichetBody() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<Notice | null>(null);

  const notificationsQuery = useInfiniteQuery(notificationsInfiniteQueryOptions);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    void queryClient.invalidateQueries({ queryKey: unreadQueryKey });
  };

  const readMutation = useMutation({
    mutationFn: markRead,
    onSuccess: () => setNotice({ tone: 'success', message: GUICHIET.feedback.markedOne }),
    onError: (error) => setNotice({ tone: 'error', message: notificationsErrorMessage(error) }),
    onSettled: invalidate,
  });

  const readAllMutation = useMutation({
    mutationFn: markAllRead,
    onSuccess: (result) =>
      setNotice({ tone: 'success', message: GUICHIET.markAllDone(result.marked) }),
    onError: (error) => setNotice({ tone: 'error', message: notificationsErrorMessage(error) }),
    onSettled: invalidate,
  });

  if (notificationsQuery.isPending) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/60">
        {GUICHIET.loading}
      </p>
    );
  }

  if (notificationsQuery.isError) {
    return (
      <div className="space-y-4 rounded-sheet border border-oxide/40 bg-cabinet-raised p-6">
        <FormError message={notificationsErrorMessage(notificationsQuery.error)} />
        <button
          type="button"
          onClick={() => void notificationsQuery.refetch()}
          className={SECONDARY_ACTION}
        >
          {GUICHIET.retry}
        </button>
      </div>
    );
  }

  const pages = notificationsQuery.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  // Le compteur vient du serveur, la page la plus récente est en tête : chaque
  // page porte le compte de son instant de lecture, donc la première est la plus
  // fraîche. Il n'est jamais recalculé depuis les lignes affichées.
  const unread = pages.length === 0 ? 0 : (pages[0]?.unread ?? 0);
  const busy = readMutation.isPending || readAllMutation.isPending;
  const groups = groupByKind(items);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-vellum/55">
          {unread === 0 ? GUICHIET.bell.announce(0) : `${unread} ${GUICHIET.unreadSuffix(unread)}`}
        </p>
        {unread > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => readAllMutation.mutate()}
            className={PRIMARY_ACTION}
          >
            {GUICHIET.markAll}
          </button>
        ) : null}
      </div>

      <p
        aria-live="polite"
        className={`min-h-[18px] font-mono text-[10px] uppercase tracking-[0.14em] ${
          notice?.tone === 'error' ? 'text-oxide' : 'text-brass'
        }`}
      >
        {notice?.message ?? ''}
      </p>

      {items.length === 0 ? (
        <section className="rounded-sheet border border-veil bg-cabinet-raised p-6">
          <h2 className="font-display text-lg text-vellum">{GUICHIET.emptyTitle}</h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-vellum/60">
            {GUICHIET.emptyBody}
          </p>
        </section>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <Panel key={group.key} title={group.title} count={group.items.length}>
              {group.items.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  busy={busy}
                  onMarkRead={(id) => readMutation.mutate(id)}
                />
              ))}
            </Panel>
          ))}
        </div>
      )}

      {notificationsQuery.hasNextPage ? (
        <button
          type="button"
          disabled={notificationsQuery.isFetchingNextPage}
          onClick={() => void notificationsQuery.fetchNextPage()}
          className={SECONDARY_ACTION}
        >
          {GUICHIET.showMore}
        </button>
      ) : null}
    </div>
  );
}

interface PanelProps {
  title: string;
  count: number;
  children: ReactNode;
}

function Panel({ title, count, children }: PanelProps) {
  return (
    <section className="rounded-sheet border border-veil bg-cabinet-raised p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg text-vellum">{title}</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/55">
          {GUICHIET.countLabel(count)}
        </span>
      </div>
      <ul className="mt-4 space-y-2">{children}</ul>
    </section>
  );
}

function NotificationRow({
  item,
  busy,
  onMarkRead,
}: {
  item: NotificationItem;
  busy: boolean;
  onMarkRead: (id: string) => void;
}) {
  const unread = item.readAt === null;
  const playerId = stringField(item.payload, 'playerId');

  return (
    <li
      data-unread={unread ? 'true' : 'false'}
      className="flex flex-col gap-3 rounded-[2px] border border-veil bg-cabinet-sunk/40 p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 space-y-1">
        <p className="flex items-start gap-2 text-[14px] leading-snug text-vellum">
          {unread ? (
            <span
              aria-hidden="true"
              className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brass"
            />
          ) : null}
          <span className="min-w-0">{describeNotification(item)}</span>
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/50">
          <time dateTime={item.createdAt}>{formatWhen(item.createdAt)}</time>
          {' · '}
          {unread ? GUICHIET.unreadLabel : GUICHIET.readLabel}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {playerId ? (
          <Link
            to="/players/$playerId"
            params={{ playerId }}
            className={SECONDARY_ACTION}
            aria-label={`${GUICHIET.actions.viewPlayer} — ${stringField(item.payload, 'pseudo') ?? GUICHIET.unknownPseudo}`}
          >
            {GUICHIET.actions.viewPlayer}
          </Link>
        ) : null}
        {unread ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onMarkRead(item.id)}
            aria-label={`${GUICHIET.actions.markRead} — ${describeNotification(item)}`}
            className={SECONDARY_ACTION}
          >
            {GUICHIET.actions.markRead}
          </button>
        ) : null}
      </div>
    </li>
  );
}

interface Group {
  key: string;
  title: string;
  items: NotificationItem[];
}

/** Les sections suivent l'ordre des `kind` partagés ; les groupes vides ne rendent rien. */
function groupByKind(items: readonly NotificationItem[]): Group[] {
  const groups: Group[] = NOTIFICATION_KINDS.map((kind) => ({
    key: kind,
    title: GUICHIET.sections[kind],
    items: [],
  }));
  const byKind = new Map<string, Group>(groups.map((group) => [group.key, group]));
  const others: Group = { key: 'other', title: GUICHIET.otherSection, items: [] };

  for (const item of items) {
    (byKind.get(item.kind) ?? others).items.push(item);
  }

  return [...groups, others].filter((group) => group.items.length > 0);
}

/** Une clé absente ou d'un type inattendu ne fait jamais échouer le rendu. */
function stringField(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberField(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Les `TRADE_*` sont rendus sans lire leur charge utile : la phase 40 en décide
 * la forme. Une clé inconnue ne produit jamais d'exception.
 */
function describeNotification(item: NotificationItem): string {
  const { payload } = item;
  if (!isNotificationKind(item.kind)) {
    return GUICHIET.descriptions.unknown;
  }

  switch (item.kind) {
    case 'FRIEND_REQUEST':
      return GUICHIET.descriptions.FRIEND_REQUEST(
        stringField(payload, 'pseudo') ?? GUICHIET.unknownPseudo,
      );
    case 'FRIEND_ACCEPTED':
      return GUICHIET.descriptions.FRIEND_ACCEPTED(
        stringField(payload, 'pseudo') ?? GUICHIET.unknownPseudo,
      );
    case 'ACHIEVEMENT':
      return GUICHIET.descriptions.ACHIEVEMENT(
        stringField(payload, 'label') ?? GUICHIET.unknownLabel,
        numberField(payload, 'payout'),
      );
    case 'MARKET_SOLD':
      return GUICHIET.descriptions.MARKET_SOLD(
        numberField(payload, 'price'),
        stringField(payload, 'buyerPseudo'),
      );
    case 'MARKET_BOUGHT':
      return GUICHIET.descriptions.MARKET_BOUGHT(numberField(payload, 'price'));
    default:
      return GUICHIET.descriptions[item.kind];
  }
}

/** Date relative courte, absolue au-delà d'une semaine. */
function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return GUICHIET.when.now;
  if (minutes < 60) return GUICHIET.when.minutes(minutes);

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return GUICHIET.when.hours(hours);

  const days = Math.floor(hours / 24);
  if (days < 7) return GUICHIET.when.days(days);

  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(date);
}
