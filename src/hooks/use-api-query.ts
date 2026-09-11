"use client";

import {
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
  useQuery,
} from "@tanstack/react-query";

import type { ApiError } from "@/services/api";

/**
 * Reusable query hook bound to our normalized {@link ApiError} type.
 *
 * Thin by design: it only fixes the error type and forwards everything else to
 * TanStack, so features stay flexible while gaining consistent error typing.
 *
 *   const { data } = useApiQuery({
 *     queryKey: queryKeys.users.list(),
 *     queryFn: () => http.get<User[]>("/users"),
 *   });
 */
export function useApiQuery<
  TData,
  TError = ApiError,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseQueryOptions<TData, TError, TData, TQueryKey>,
): UseQueryResult<TData, TError> {
  return useQuery(options);
}
