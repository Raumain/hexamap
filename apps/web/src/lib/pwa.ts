import { registerSW } from 'virtual:pwa-register';

/** Signature renvoyée par `registerSW` : recharger la page après activation. */
export type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>;

let updateServiceWorker: UpdateServiceWorker | undefined;
let updateWaiting = false;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Enregistre le service worker une seule fois et renvoie la fonction de mise à jour. */
export function registerPwa(): UpdateServiceWorker | undefined {
  if (updateServiceWorker) return updateServiceWorker;

  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateWaiting = true;
      emit();
    },
    onRegisterError(error) {
      console.error('Service worker : enregistrement impossible', error);
    },
  });

  return updateServiceWorker;
}

export function isPwaUpdateWaiting(): boolean {
  return updateWaiting;
}

export function subscribeToPwaUpdate(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Active la nouvelle version (le service worker attend un `skipWaiting`). */
export function applyPwaUpdate(): void {
  void updateServiceWorker?.(true);
}

export function dismissPwaUpdate(): void {
  updateWaiting = false;
  emit();
}
