import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { GUICHIET } from '../../content/guichet';
import { unreadCountQueryOptions } from '../../lib/notifications';
import { useSessionState } from '../../lib/session';

/**
 * La cloche du Guichet. Elle rend exactement le compteur du serveur : aucun
 * état local, aucun décrément optimiste. Son libellé accessible et une région
 * `aria-live` disent la valeur, la pastille ne fait que la montrer.
 */
export function NotificationBell({ className }: { className?: string }) {
  const session = useSessionState();
  const signedIn = session.status === 'authenticated';
  const unreadQuery = useQuery({ ...unreadCountQueryOptions, enabled: signedIn });

  if (!signedIn) return null;

  const unread = unreadQuery.data?.unread ?? 0;
  const shown = Math.min(unread, GUICHIET.bell.cap);

  return (
    <Link
      to="/guichet"
      aria-label={unread > 0 ? GUICHIET.bell.labelUnread(unread) : GUICHIET.bell.label}
      className={[
        'relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[2px] text-vellum/70 transition-colors duration-150 hover:text-brass focus-visible:ring-2 focus-visible:ring-brass/60 focus-visible:outline-none',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <svg
        aria-hidden="true"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3a5 5 0 0 1 5 5v4l2 3H5l2-3V8a5 5 0 0 1 5-5M10 18a2 2 0 0 0 4 0" />
      </svg>
      {unread > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-brass px-1 font-mono text-[10px] font-medium tabular-nums leading-none text-cabinet"
        >
          {shown}
        </span>
      ) : null}
      <span aria-live="polite" className="sr-only">
        {GUICHIET.bell.announce(unread)}
      </span>
    </Link>
  );
}
