import { PUSH_DEFAULT_QUIET_END, PUSH_DEFAULT_QUIET_START } from '@hexamap/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { PUSH_ROOM } from '../../content/push';
import {
  currentSubscription,
  detectPushEnvironment,
  type PushEnvironmentState,
  pushConfigQueryOptions,
  pushPreferencesQueryKey,
  pushPreferencesQueryOptions,
  savePushPreferences,
  subscribeToPush,
  unsubscribeFromPush,
} from '../../lib/push-client';
import { Button } from '../button';
import { FormError } from '../form-error';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const SELECT_CLASS =
  'min-h-11 rounded-[2px] border border-veil bg-cabinet-sunk px-3 font-mono text-[12px] text-vellum focus:border-brass focus:outline-none';

type PushState =
  | 'detecting'
  | 'unsupported'
  | 'ios-requires-install'
  | 'loading'
  | 'disabled'
  | 'denied'
  | 'available';

interface Notice {
  tone: 'success' | 'error';
  message: string;
}

/**
 * « La Sonnette » — la bascule d'abonnement et les heures calmes.
 *
 * Le composant ne décide de rien : `pushSupport` du domaine partagé tranche le
 * support (iOS exige une PWA installée en 16.4+), la configuration du serveur
 * tranche la disponibilité, et le serveur seul décide d'envoyer. Ici on n'affiche
 * que l'état réel et les deux gestes qui existent — activer, éteindre.
 *
 * `useState` est légitime : rien de tout cela ne pilote le Canvas de grattage.
 */
export function PushOptin() {
  const queryClient = useQueryClient();
  const quietStartId = useId();
  const quietEndId = useId();

  const config = useQuery(pushConfigQueryOptions());
  const preferences = useQuery(pushPreferencesQueryOptions());

  const [environment, setEnvironment] = useState<PushEnvironmentState | null>(null);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [quietStart, setQuietStart] = useState(PUSH_DEFAULT_QUIET_START);
  const [quietEnd, setQuietEnd] = useState(PUSH_DEFAULT_QUIET_END);

  useEffect(() => {
    setEnvironment(detectPushEnvironment());

    // L'abonnement local est la seule chose que le joueur observe : une ligne
    // serveur peut survivre à un navigateur changé, et l'inverse aussi.
    void currentSubscription()
      .then((subscription) => setSubscribed(subscription !== null))
      .catch(() => setSubscribed(false));
  }, []);

  useEffect(() => {
    if (preferences.data === undefined) return;
    setQuietStart(preferences.data.quietStart);
    setQuietEnd(preferences.data.quietEnd);
  }, [preferences.data]);

  const state: PushState = (() => {
    if (environment === null) return 'detecting';
    if (environment.support === 'unsupported') return 'unsupported';
    if (environment.support === 'ios-requires-install') return 'ios-requires-install';
    if (config.data === undefined) return 'loading';
    if (!config.data.enabled) return 'disabled';
    if (environment.permission === 'denied') return 'denied';
    return 'available';
  })();

  const toggle = async (): Promise<void> => {
    setBusy(true);
    setNotice(null);

    try {
      if (subscribed === true) {
        await unsubscribeFromPush();
        setSubscribed(false);
      } else {
        await subscribeToPush();
        setSubscribed(true);
        setEnvironment(detectPushEnvironment());
      }
    } catch {
      setNotice({
        tone: 'error',
        message: subscribed === true ? PUSH_ROOM.disableFailed : PUSH_ROOM.enableFailed,
      });
      // L'état local peut avoir changé malgré l'échec : on le relit.
      void currentSubscription()
        .then((subscription) => setSubscribed(subscription !== null))
        .catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const saveQuiet = async (): Promise<void> => {
    setBusy(true);
    setNotice(null);

    try {
      const saved = await savePushPreferences({ quietStart, quietEnd });
      queryClient.setQueryData(pushPreferencesQueryKey, saved);
      setNotice({ tone: 'success', message: PUSH_ROOM.quiet.saved });
    } catch {
      setNotice({ tone: 'error', message: PUSH_ROOM.preferencesFailed });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-push-state={state} className="space-y-5">
      {state === 'detecting' ? (
        <p className="font-mono text-[11px] text-vellum/60">{PUSH_ROOM.detecting}</p>
      ) : null}

      {state === 'unsupported' ? (
        <p data-push-message="unsupported" className="text-sm leading-relaxed text-vellum/70">
          {PUSH_ROOM.unsupported}
        </p>
      ) : null}

      {state === 'ios-requires-install' ? (
        <p data-push-message="ios-install" className="text-sm leading-relaxed text-vellum/70">
          {PUSH_ROOM.iosInstall}
        </p>
      ) : null}

      {state === 'loading' ? (
        <p className="font-mono text-[11px] text-vellum/60">{PUSH_ROOM.loading}</p>
      ) : null}

      {state === 'disabled' ? (
        <p data-push-message="disabled" className="text-sm leading-relaxed text-vellum/70">
          {PUSH_ROOM.disabled}
        </p>
      ) : null}

      {state === 'denied' ? (
        <p data-push-message="denied" className="text-sm leading-relaxed text-vellum/70">
          {PUSH_ROOM.permissionDenied}
        </p>
      ) : null}

      {state === 'available' ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p
              role="status"
              aria-live="polite"
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-vellum/65"
            >
              {subscribed === true ? PUSH_ROOM.subscribed : PUSH_ROOM.notSubscribed}
            </p>
            <Button
              variant={subscribed === true ? 'secondary' : 'primary'}
              isPending={busy}
              onClick={() => {
                void toggle();
              }}
            >
              {subscribed === true ? PUSH_ROOM.disable : PUSH_ROOM.enable}
            </Button>
          </div>

          <div className="border-t border-veil/70 pt-4">
            <h3 className="font-display text-base font-semibold text-vellum">
              {PUSH_ROOM.quiet.title}
            </h3>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-vellum/70">
              {PUSH_ROOM.quiet.description}
            </p>

            <div className="mt-4 flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor={quietStartId}
                  className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/55"
                >
                  {PUSH_ROOM.quiet.from}
                </label>
                <select
                  id={quietStartId}
                  className={SELECT_CLASS}
                  value={quietStart}
                  onChange={(event) => setQuietStart(Number(event.currentTarget.value))}
                >
                  {HOURS.map((hour) => (
                    <option key={hour} value={hour}>
                      {PUSH_ROOM.quiet.hour(hour)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor={quietEndId}
                  className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/55"
                >
                  {PUSH_ROOM.quiet.to}
                </label>
                <select
                  id={quietEndId}
                  className={SELECT_CLASS}
                  value={quietEnd}
                  onChange={(event) => setQuietEnd(Number(event.currentTarget.value))}
                >
                  {HOURS.map((hour) => (
                    <option key={hour} value={hour}>
                      {PUSH_ROOM.quiet.hour(hour)}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                variant="secondary"
                isPending={busy}
                onClick={() => {
                  void saveQuiet();
                }}
              >
                {PUSH_ROOM.quiet.save}
              </Button>
            </div>

            {quietStart === quietEnd ? (
              <p className="mt-3 font-mono text-[11px] leading-relaxed text-vellum/55">
                {PUSH_ROOM.quiet.disabled}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {notice === null ? null : notice.tone === 'error' ? (
        <FormError message={notice.message} />
      ) : (
        <p
          role="status"
          aria-live="polite"
          className="rounded-[2px] border border-verdigris/45 bg-verdigris/10 px-3 py-2 font-mono text-[11px] leading-relaxed text-verdigris"
        >
          {notice.message}
        </p>
      )}
    </div>
  );
}
