import { isServer, QueryClient } from "@tanstack/react-query";

import type { ApiError } from "@/services/api";

/**
 * Factory for a configured QueryClient. Centralizes caching/retry policy so
 * every consumer behaves consistently.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000, // 1 minute — avoid refetch storms
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Don't retry client errors (4xx); do retry transient ones.
          const status = (error as unknown as ApiError)?.status;
          if (status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Returns a per-request client on the server and a singleton in the browser,
 * per the TanStack Next.js App Router guidance.
 */
export function getQueryClient(): QueryClient {
  if (isServer) {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
