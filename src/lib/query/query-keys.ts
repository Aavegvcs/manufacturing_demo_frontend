/**
 * Centralized, type-safe query-key registry. Co-locating keys prevents typos
 * and makes targeted cache invalidation discoverable.
 *
 * Usage:
 *   queryKeys.users.list({ page: 1 })
 *   queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
 *
 * Extend per feature; the `as const` preserves literal types for inference.
 */
export const queryKeys = {
  catalog: {
    all: ["catalog"] as const,
    tree: () => [...queryKeys.catalog.all, "tree"] as const,
    parameter: (productId: string, section?: string) =>
      [
        ...queryKeys.catalog.all,
        "parameter",
        productId,
        section ?? "all",
      ] as const,
    calculation: (productId: string) =>
      [...queryKeys.catalog.all, "calculation", productId] as const,
    overview: (productId: string) =>
      [...queryKeys.catalog.all, "overview", productId] as const,
    sections: (productId: string) =>
      [...queryKeys.catalog.all, "sections", productId] as const,
    sectionContent: (productId: string, section: string) =>
      [...queryKeys.catalog.all, "section", productId, section] as const,
  },
  users: {
    all: ["users"] as const,
    lists: () => [...queryKeys.users.all, "list"] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.users.lists(), params ?? {}] as const,
    details: () => [...queryKeys.users.all, "detail"] as const,
    detail: (id: string | number) =>
      [...queryKeys.users.details(), id] as const,
  },
} as const;
