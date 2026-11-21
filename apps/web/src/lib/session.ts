import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSession, type SessionUser } from './auth';

export const sessionQueryKey = ['auth', 'session'] as const;

export const sessionQueryOptions = queryOptions({
  queryKey: sessionQueryKey,
  queryFn: async () => {
    const { data, error } = await getSession();
    if (error) throw new Error(error.message ?? 'Session indisponible');
    return data;
  },
  staleTime: 30_000,
});

export function useSession() {
  return useQuery(sessionQueryOptions);
}

/**
 * État de session tel qu'un garde de route doit le lire. Une requête en échec
 * n'est pas une déconnexion : seule une réponse aboutie sans utilisateur vaut
 * « anonyme ». Tant que les retries tournent, l'état reste « loading ».
 */
export type SessionState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: SessionUser }
  | { status: 'unavailable'; retry: () => void };

export function useSessionState(): SessionState {
  const query = useSession();
  const user = query.data?.user;

  if (user) {
    return { status: 'authenticated', user };
  }

  if (query.isSuccess) {
    return { status: 'anonymous' };
  }

  // TanStack expose `status: 'error'` dès la première tentative échouée, `data`
  // vide, pendant que les retries tournent : `isFetching` distingue les deux.
  if (query.isError && !query.isFetching) {
    return { status: 'unavailable', retry: () => void query.refetch() };
  }

  return { status: 'loading' };
}

export function useSessionUser(): SessionUser | undefined {
  return useSession().data?.user ?? undefined;
}

export function useInvalidateSession() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: sessionQueryKey });
}
