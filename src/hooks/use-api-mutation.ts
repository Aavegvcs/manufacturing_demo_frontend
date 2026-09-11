"use client";

import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import type { ApiError } from "@/services/api";

type ApiMutationOptions<TData, TVariables, TContext> = UseMutationOptions<
  TData,
  ApiError,
  TVariables,
  TContext
> & {
  /**
   * Query keys to invalidate on success — the common case after a write.
   * Saves wiring `onSuccess` + `queryClient` in every feature.
   */
  invalidateKeys?: readonly (readonly unknown[])[];
};

/**
 * Reusable mutation hook bound to our normalized {@link ApiError} type, with
 * declarative cache invalidation.
 *
 *   const { mutate } = useApiMutation({
 *     mutationFn: (body: NewUser) => http.post<User>("/users", body),
 *     invalidateKeys: [queryKeys.users.all],
 *   });
 */
export function useApiMutation<TData, TVariables = void, TContext = unknown>(
  options: ApiMutationOptions<TData, TVariables, TContext>,
): UseMutationResult<TData, ApiError, TVariables, TContext> {
  const queryClient = useQueryClient();
  const { invalidateKeys, onSuccess, ...rest } = options;

  return useMutation<TData, ApiError, TVariables, TContext>({
    ...rest,
    // Forward all callback args via rest so we stay compatible across TanStack
    // minor versions (the callback arity has changed within v5).
    onSuccess: async (...args) => {
      if (invalidateKeys?.length) {
        await Promise.all(
          invalidateKeys.map((queryKey) =>
            queryClient.invalidateQueries({ queryKey }),
          ),
        );
      }
      await onSuccess?.(...args);
    },
  });
}
