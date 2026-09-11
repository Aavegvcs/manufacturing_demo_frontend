"use client";

import { useApiMutation, useApiQuery } from "@/hooks";
import { queryKeys } from "@/lib/query";
import { userService } from "./user.service";
import type { CreateUserInput } from "./user.types";

/**
 * Feature-level hooks: compose the generic query/mutation hooks with the
 * service and centralized keys. Components import only these — they never touch
 * http, query keys, or cache invalidation directly.
 */

export function useUsers(params?: { page?: number; search?: string }) {
  return useApiQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => userService.list(params),
  });
}

export function useUser(id: string) {
  return useApiQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => userService.getById(id),
    enabled: Boolean(id),
  });
}

export function useCreateUser() {
  return useApiMutation({
    mutationFn: (input: CreateUserInput) => userService.create(input),
    invalidateKeys: [queryKeys.users.all],
  });
}

export function useDeleteUser() {
  return useApiMutation({
    mutationFn: (id: string) => userService.remove(id),
    invalidateKeys: [queryKeys.users.all],
  });
}
