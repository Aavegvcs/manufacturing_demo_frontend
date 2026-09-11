import { AxiosError } from "axios";

import type { ApiError } from "./types";

/**
 * Translates any thrown value into a normalized {@link ApiError}.
 * Keeps axios-specific knowledge in one place so callers stay transport-agnostic.
 */
export function normalizeError(error: unknown): ApiError {
  if (error instanceof AxiosError) {
    const response = error.response;

    // Server responded with an error status.
    if (response) {
      const payload = response.data as
        | {
            message?: string;
            code?: string;
            errors?: Record<string, string[]>;
          }
        | undefined;

      return {
        status: response.status,
        message:
          payload?.message ?? error.message ?? "Unexpected server error.",
        code: payload?.code,
        fieldErrors: payload?.errors,
        details: payload,
      };
    }

    // Request made but no response (network down, CORS, timeout).
    return {
      status: 0,
      message:
        error.code === "ECONNABORTED"
          ? "The request timed out. Please try again."
          : "Network error. Please check your connection.",
      code: error.code,
      details: error.toJSON(),
    };
  }

  if (error instanceof Error) {
    return { status: 0, message: error.message, details: error };
  }

  return { status: 0, message: "An unknown error occurred.", details: error };
}

/** Type guard for the normalized error shape. */
export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    "message" in value
  );
}
