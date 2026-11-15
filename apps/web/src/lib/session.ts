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

export function useSessionUser(): SessionUser | undefined {
  return useSession().data?.user ?? undefined;
}

export function useInvalidateSession() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: sessionQueryKey });
}
