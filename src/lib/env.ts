/**
 * Centralized, typed access to public runtime configuration.
 * Single source of truth for environment-derived values (SRP).
 */
export const env = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api",
  apiTimeout: Number(process.env.NEXT_PUBLIC_API_TIMEOUT ?? 30_000),
} as const;
