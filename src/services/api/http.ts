import type { AxiosRequestConfig } from "axios";

import { normalizeError } from "./api-error";
import { axiosClient } from "./axios-client";

/**
 * Thin, typed wrapper over the axios client. Every method returns the unwrapped
 * response body on success and throws a normalized `ApiError` on failure.
 *
 * Consumers (TanStack hooks, server actions, services) depend on this small
 * interface rather than axios directly — making it trivial to mock in tests or
 * swap the transport later (Dependency Inversion + Interface Segregation).
 */
async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await axiosClient.request<T>(config);
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export const http = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: "GET", url }),

  post: <T, B = unknown>(url: string, body?: B, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: "POST", url, data: body }),

  put: <T, B = unknown>(url: string, body?: B, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: "PUT", url, data: body }),

  patch: <T, B = unknown>(url: string, body?: B, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: "PATCH", url, data: body }),

  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: "DELETE", url }),
} as const;

export type Http = typeof http;
