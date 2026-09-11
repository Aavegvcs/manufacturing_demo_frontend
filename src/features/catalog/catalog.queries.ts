"use client";

import { useQueries } from "@tanstack/react-query";

import { useApiQuery } from "@/hooks";
import { queryKeys } from "@/lib/query";
import { catalogService } from "./catalog.service";
import type { ProductOverview, SectionKey } from "./catalog.types";

/** Fetches the full product catalog tree. Cached and deduped by TanStack. */
export function useCatalogTree() {
  return useApiQuery({
    queryKey: queryKeys.catalog.tree(),
    queryFn: () => catalogService.getTree(),
    staleTime: 5 * 60_000, // catalog rarely changes within a session
  });
}

/**
 * Fetches the parameter schema (right-side panel) for a single product.
 * Pass `section` to get only that tab's parameters (the set differs per tab);
 * omit it for the complete schema (used to seed the default selection).
 */
export function useProductParameter(
  productId: string | null | undefined,
  section?: SectionKey | null,
) {
  return useApiQuery({
    queryKey: queryKeys.catalog.parameter(
      productId ?? "",
      section ?? undefined,
    ),
    queryFn: () =>
      catalogService.getProductParameter(
        productId as string,
        section ?? undefined,
      ),
    enabled: Boolean(productId),
    staleTime: 5 * 60_000,
  });
}

/** Fetches the performance datasets (Calculation page) for a single product. */
export function useProductCalculation(productId: string | null | undefined) {
  return useApiQuery({
    queryKey: queryKeys.catalog.calculation(productId ?? ""),
    queryFn: () => catalogService.getCalculation(productId as string),
    enabled: Boolean(productId),
    staleTime: 5 * 60_000,
  });
}

/** Fetches the Overview payload (image, facts, description) for a product. */
export function useProductOverview(productId: string | null | undefined) {
  return useApiQuery({
    queryKey: queryKeys.catalog.overview(productId ?? ""),
    queryFn: () => catalogService.getOverview(productId as string),
    enabled: Boolean(productId),
    staleTime: 5 * 60_000,
  });
}

/**
 * Fetches Overview payloads for several products at once (product comparison).
 * Returns results aligned with `ids`; each entry is a TanStack query result.
 */
export function useProductOverviews(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.catalog.overview(id),
      queryFn: () => catalogService.getOverview(id),
      staleTime: 5 * 60_000,
    })),
  }) as Array<{
    data: ProductOverview | undefined;
    isLoading: boolean;
    isError: boolean;
  }>;
}

/** Fetches the dynamic tab list (section keys) for a single product. */
export function useProductSections(productId: string | null | undefined) {
  return useApiQuery({
    queryKey: queryKeys.catalog.sections(productId ?? ""),
    queryFn: () => catalogService.getProductSections(productId as string),
    enabled: Boolean(productId),
    staleTime: 5 * 60_000,
  });
}

/** Fetches one section's content for a product (own endpoint per section). */
export function useProductSectionContent(
  productId: string | null | undefined,
  section: SectionKey | null | undefined,
) {
  return useApiQuery({
    queryKey: queryKeys.catalog.sectionContent(productId ?? "", section ?? ""),
    queryFn: () =>
      catalogService.getProductSectionContent(
        productId as string,
        section as SectionKey,
      ),
    enabled: Boolean(productId) && Boolean(section),
    staleTime: 5 * 60_000,
  });
}
