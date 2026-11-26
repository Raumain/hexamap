import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, Navigate } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { FormError } from '../components/form-error';
import { FriendTradePanel } from '../components/trade/friend-trade-panel';
import { SessionUnavailable } from '../components/ui/session-unavailable';
import { FRIENDS } from '../content/friends';
import {
  acceptRequest,
  blockPlayer,
  declineRequest,
  type FriendEntry,
  friendsErrorMessage,
  friendsQueryKey,
  friendsQueryOptions,
  removeFriend,
  sendRequest,
} from '../lib/friends';
import { useSessionState } from '../lib/session';

const PRIMARY_ACTION =
  'inline-flex min-h-[44px] items-center justify-center rounded-[2px] border border-brass-deep bg-brass px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-cabinet shadow-brass transition-colors duration-150 hover:bg-brass-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/60 disabled:cursor-not-allowed disabled:opacity-60';

const SECONDARY_ACTION =
  'inline-flex min-h-[44px] items-center justify-center rounded-[2px] border border-veil px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-vellum/70 transition-colors duration-150 hover:border-brass/40 hover:text-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/60 disabled:cursor-not-allowed disabled:opacity-60';

const DANGER_ACTION =
  'inline-flex min-h-[44px] items-center justify-center rounded-[2px] border border-oxide/40 px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-oxide/80 transition-colors duration-150 hover:border-oxide hover:text-oxide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxide/60 disabled:cursor-not-allowed disabled:opacity-60';

interface Notice {
  tone: 'success' | 'error';
  message: string;
}

export const Route = createFileRoute('/friends')({
  component: FriendsPage,
});

function FriendsPage() {
  const session = useSessionState();

  return (
    <section className="space-y-10">
      <header>
        <p className="salon-eyebrow">{FRIENDS.eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-vellum md:text-5xl">
          {FRIENDS.title}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-vellum/70">{FRIENDS.subtitle}</p>
        <div className="brass-rule mt-5 w-24" />
      </header>

      {session.status === 'loading' ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/60">
          {FRIENDS.loadingSession}
        </p>
      ) : session.status === 'unavailable' ? (
        <SessionUnavailable onRetry={session.retry} />
      ) : session.status === 'anonymous' ? (
        <Navigate to="/login" />
      ) : (
        <FriendsBody />
      )}
    </section>
  );
}

function FriendsBody() {
  const queryClient = useQueryClient();
  const [pseudo, setPseudo] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [blockingId, setBlockingId] = useState<string | null>(null);

  const friendsQuery = useQuery(friendsQueryOptions);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: friendsQueryKey });

  const requestMutation = useMutation({
    mutationFn: sendRequest,
    onSuccess: (result) => {
      setPseudo('');
      setNotice({
        tone: 'success',
        message:
          result.status === 'ACCEPTED'
            ? FRIENDS.feedback.requestAccepted
            : FRIENDS.feedback.requestSent,
      });
    },
    onError: (error) => setNotice({ tone: 'error', message: friendsErrorMessage(error) }),
    onSettled: invalidate,
  });

  const acceptMutation = useMutation({
    mutationFn: acceptRequest,
    onSuccess: () => setNotice({ tone: 'success', message: FRIENDS.feedback.accepted }),
    onError: (error) => setNotice({ tone: 'error', message: friendsErrorMessage(error) }),
    onSettled: invalidate,
  });

  const declineMutation = useMutation({
    mutationFn: declineRequest,
    onSuccess: () => setNotice({ tone: 'success', message: FRIENDS.feedback.declined }),
    onError: (error) => setNotice({ tone: 'error', message: friendsErrorMessage(error) }),
    onSettled: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (input: { id: string; message: string }) => removeFriend(input.id),
    onSuccess: (_data, input) => setNotice({ tone: 'success', message: input.message }),
    onError: (error) => setNotice({ tone: 'error', message: friendsErrorMessage(error) }),
    onSettled: invalidate,
  });

  const blockMutation = useMutation({
    mutationFn: blockPlayer,
    onSuccess: () => {
      setBlockingId(null);
      setNotice({ tone: 'success', message: FRIENDS.feedback.blocked });
    },
    onError: (error) => {
      setBlockingId(null);
      setNotice({ tone: 'error', message: friendsErrorMessage(error) });
    },
    onSettled: invalidate,
  });

  if (friendsQuery.isPending) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/60">
        {FRIENDS.loading}
      </p>
    );
  }

  if (friendsQuery.isError) {
    return (
      <div className="space-y-4 rounded-sheet border border-oxide/40 bg-cabinet-raised p-6">
        <FormError message={friendsErrorMessage(friendsQuery.error)} />
        <button
          type="button"
          onClick={() => void friendsQuery.refetch()}
          className={SECONDARY_ACTION}
        >
          {FRIENDS.retry}
        </button>
      </div>
    );
  }

  const friends = friendsQuery.data?.friends ?? [];
  const incoming = friendsQuery.data?.incoming ?? [];
  const outgoing = friendsQuery.data?.outgoing ?? [];

  const busy =
    requestMutation.isPending ||
    acceptMutation.isPending ||
    declineMutation.isPending ||
    removeMutation.isPending ||
    blockMutation.isPending;

  const draft = pseudo.trim();

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <label
          htmlFor="friends-pseudo"
          className="block font-mono text-[9px] uppercase tracking-[0.18em] text-vellum/60"
        >
          {FRIENDS.search.label}
        </label>
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.length === 0) {
              setNotice({ tone: 'error', message: FRIENDS.search.emptyPseudo });
              return;
            }
            setNotice(null);
            requestMutation.mutate(draft);
          }}
        >
          <input
            id="friends-pseudo"
            name="pseudo"
            type="text"
            value={pseudo}
            onChange={(event) => setPseudo(event.target.value)}
            maxLength={24}
            autoComplete="off"
            placeholder={FRIENDS.search.placeholder}
            className="h-11 w-full flex-1 rounded-[2px] border border-veil bg-cabinet-sunk/60 px-3 font-display text-[15px] text-vellum placeholder:text-vellum/40 focus-visible:border-brass/60 focus-visible:outline-none"
          />
          <button type="submit" disabled={busy} className={PRIMARY_ACTION}>
            {FRIENDS.search.submit}
          </button>
        </form>
        <p
          aria-live="polite"
          className={`min-h-[18px] font-mono text-[10px] uppercase tracking-[0.14em] ${
            notice?.tone === 'error' ? 'text-oxide' : 'text-brass'
          }`}
        >
          {notice?.message ?? ''}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="space-y-6">
          <Panel
            title={FRIENDS.sections.incoming}
            count={incoming.length}
            empty={FRIENDS.empty.incoming}
          >
            {incoming.map((entry) => (
              <EntryRow key={entry.id} entry={entry}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => acceptMutation.mutate(entry.id)}
                  className={PRIMARY_ACTION}
                >
                  {FRIENDS.actions.accept}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => declineMutation.mutate(entry.id)}
                  className={SECONDARY_ACTION}
                >
                  {FRIENDS.actions.decline}
                </button>
              </EntryRow>
            ))}
          </Panel>

          <Panel
            title={FRIENDS.sections.outgoing}
            count={outgoing.length}
            empty={FRIENDS.empty.outgoing}
          >
            {outgoing.map((entry) => (
              <EntryRow key={entry.id} entry={entry}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    removeMutation.mutate({ id: entry.id, message: FRIENDS.feedback.cancelled })
                  }
                  className={SECONDARY_ACTION}
                >
                  {FRIENDS.actions.cancel}
                </button>
              </EntryRow>
            ))}
          </Panel>
        </div>

        <Panel
          title={FRIENDS.sections.friends}
          count={friends.length}
          empty={FRIENDS.empty.friends}
        >
          {friends.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              detail={
                <FriendTradePanel
                  friendId={entry.player.id}
                  pseudo={entry.player.pseudo ?? FRIENDS.unknownPseudo}
                />
              }
            >
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  removeMutation.mutate({ id: entry.id, message: FRIENDS.feedback.removed })
                }
                className={SECONDARY_ACTION}
              >
                {FRIENDS.actions.remove}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setBlockingId(entry.player.id)}
                className={DANGER_ACTION}
              >
                {FRIENDS.actions.block}
              </button>
              {blockingId === entry.player.id ? (
                <fieldset className="flex min-w-0 flex-wrap items-center gap-2 rounded-[2px] border border-oxide/40 bg-cabinet-sunk/60 p-2">
                  <legend className="sr-only">{FRIENDS.confirm.blockLabel}</legend>
                  <p className="min-w-0 text-[13px] leading-snug text-vellum/80">
                    {FRIENDS.confirm.block(entry.player.pseudo ?? FRIENDS.unknownPseudo)}
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => blockMutation.mutate(entry.player.id)}
                    className={DANGER_ACTION}
                  >
                    {FRIENDS.confirm.blockConfirm}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setBlockingId(null)}
                    className={SECONDARY_ACTION}
                  >
                    {FRIENDS.confirm.blockCancel}
                  </button>
                </fieldset>
              ) : null}
            </EntryRow>
          ))}
        </Panel>
      </div>
    </div>
  );
}

interface PanelProps {
  title: string;
  count: number;
  empty: string;
  children: ReactNode;
}

function Panel({ title, count, empty, children }: PanelProps) {
  return (
    <section className="rounded-sheet border border-veil bg-cabinet-raised p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg text-vellum">{title}</h2>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-vellum/55">
          {FRIENDS.countLabel(count)}
        </span>
      </div>
      {count === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-vellum/60">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-2">{children}</ul>
      )}
    </section>
  );
}

function EntryRow({
  entry,
  children,
  detail,
}: {
  entry: FriendEntry;
  children: ReactNode;
  detail?: ReactNode;
}) {
  const pseudo = entry.player.pseudo ?? FRIENDS.unknownPseudo;

  // R-003 : le libellé du lien est le pseudo, jamais « voir la vitrine », et il
  // n'existe que si la vitrine est publique — une vitrine privée répond `404` par
  // dessein (architecture §2.9), donc un lien serait un lien mort.
  //
  // `detail` occupe une ligne entière sous les actions : `sm:flex-wrap` et
  // `w-full` la posent à la ligne, sans hauteur déclarée — la hauteur d'une
  // ligne reste celle de son contenu (BUG-008).
  return (
    <li className="flex flex-col gap-3 rounded-[2px] border border-veil bg-cabinet-sunk/40 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      {entry.player.profile_public ? (
        <Link
          to="/players/$playerId"
          params={{ playerId: entry.player.id }}
          className="min-w-0 truncate font-display text-[15px] text-vellum underline-offset-4 hover:underline focus-visible:underline"
        >
          {pseudo}
        </Link>
      ) : (
        <span className="min-w-0 truncate font-display text-[15px] text-vellum">{pseudo}</span>
      )}
      <div className="flex flex-wrap gap-2">{children}</div>
      {detail ? <div className="w-full min-w-0">{detail}</div> : null}
    </li>
  );
}
