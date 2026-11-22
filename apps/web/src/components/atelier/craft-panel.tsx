import { RARITY_LABELS } from '@hexamap/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ATELIER, atelierResultLabel, atelierSuccessMessage } from '../../content/collection';
import { atelierErrorMessage, craftableGroups, craftCards } from '../../lib/atelier';
import { type CollectionCard, collectionQueryKey } from '../../lib/collection';
import { collectionStatsQueryKey } from '../../lib/tickets';

const outlineButtonClass =
  'inline-flex min-h-10 items-center justify-center rounded-[2px] border border-brass/50 px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-brass transition-colors duration-150 hover:border-brass hover:text-brass-pale disabled:cursor-not-allowed disabled:opacity-40';

const primaryButtonClass =
  'inline-flex min-h-10 items-center justify-center rounded-[2px] border border-brass bg-brass/10 px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-brass transition-colors duration-150 hover:bg-brass/20 disabled:cursor-not-allowed disabled:opacity-40';

/**
 * L'Atelier dans Le Cadastre : les groupes de doublons fusibles, leur résultat
 * attendu, et une confirmation avant d'engager la fusion. Le client affiche ce
 * que la règle partagée annonce ; le serveur reste seul juge.
 */
export function CraftPanel({ items }: { items: CollectionCard[] }) {
  const queryClient = useQueryClient();
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const groups = craftableGroups(items);

  const mutation = useMutation({
    mutationFn: craftCards,
    onSuccess: () => {
      setConfirmingKey(null);
      void queryClient.invalidateQueries({ queryKey: collectionQueryKey });
      void queryClient.invalidateQueries({ queryKey: collectionStatsQueryKey });
    },
  });

  const successCard = mutation.data?.craftedCard ?? null;
  if (groups.length === 0 && successCard === null) return null;

  return (
    <section
      aria-labelledby="atelier-title"
      className="rounded-sheet border border-veil bg-cabinet-raised p-6"
    >
      <h2 id="atelier-title" className="font-display text-2xl font-semibold text-vellum">
        {ATELIER.title}
      </h2>
      <p className="mt-2 text-sm text-vellum/70">{ATELIER.intro}</p>

      {successCard ? (
        <p
          role="status"
          className="mt-3 rounded-[2px] border border-brass/40 px-3 py-2 text-sm text-brass"
        >
          {atelierSuccessMessage(
            successCard.nom || successCard.refCode,
            RARITY_LABELS[successCard.rarity],
          )}
        </p>
      ) : null}

      {mutation.error ? (
        <div role="alert" className="mt-3 text-sm text-danger">
          {atelierErrorMessage(mutation.error)}
        </div>
      ) : null}

      <ul className="mt-4 space-y-3">
        {groups.map((group) => {
          const label = group.nom || group.refCode;
          const isConfirming = group.key === confirmingKey;

          return (
            <li key={group.key} className="border-t border-veil pt-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-base text-vellum">{label}</p>
                  <p className="font-mono text-[11px] text-vellum/60">
                    {atelierResultLabel(
                      label,
                      RARITY_LABELS[group.targetRarity],
                      group.targetScore,
                      group.count,
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Fondre les doublons de ${label}`}
                  onClick={() => {
                    mutation.reset();
                    setConfirmingKey(group.key);
                  }}
                  disabled={mutation.isPending}
                  className={outlineButtonClass}
                >
                  {ATELIER.action}
                </button>
              </div>

              {isConfirming ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <p className="w-full font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/60">
                    {ATELIER.confirmTitle}
                  </p>
                  <button
                    type="button"
                    aria-label={`Confirmer la fusion de ${label}`}
                    aria-busy={mutation.isPending || undefined}
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate({
                        category: group.category,
                        refCode: group.refCode,
                        rarity: group.rarity,
                      })
                    }
                    className={primaryButtonClass}
                  >
                    {ATELIER.confirm}
                  </button>
                  <button
                    type="button"
                    aria-label={`Annuler la fusion de ${label}`}
                    onClick={() => setConfirmingKey(null)}
                    className={outlineButtonClass}
                  >
                    {ATELIER.cancel}
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
