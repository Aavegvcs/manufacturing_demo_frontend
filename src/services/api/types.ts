/**
 * Shared API contract types. Keep transport-agnostic so the rest of the app
 * never imports axios types directly (Dependency Inversion).
 */

/** Standard envelope returned by the backend. Adjust to match your API. */
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success?: boolean;
}

/** Normalized error shape surfaced to the UI regardless of transport. */
export interface ApiError {
  /** HTTP status code, or 0 for network/timeout errors. */
  status: number;
  /** Human-readable message safe to show or log. */
  message: string;
  /** Machine-readable code from the backend, when provided. */
  code?: string;
  /** Field-level validation errors keyed by field name. */
  fieldErrors?: Record<string, string[]>;
  /** Raw payload for debugging. */
  details?: unknown;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
