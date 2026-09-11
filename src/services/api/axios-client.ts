import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

import { env } from "@/lib/env";

/**
 * Optional hook for injecting an auth token into every request.
 * Set this once at app bootstrap (or from your auth store) instead of
 * scattering token logic across call sites (Open/Closed).
 */
let authTokenProvider: (() => string | null | undefined) | null = null;

export function setAuthTokenProvider(
  provider: (() => string | null | undefined) | null,
) {
  authTokenProvider = provider;
}

/**
 * The single, app-wide axios instance. All HTTP traffic flows through here so
 * cross-cutting concerns (base URL, headers, auth, error shaping) live in one place.
 */
export const axiosClient: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeout,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// --- Request interceptor: attach auth + correlation metadata -----------------
axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = authTokenProvider?.();
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// --- Response interceptor: pass through, leave normalization to callers -------
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Place global side effects here (e.g. 401 -> sign-out) without coupling
    // them to individual features. We re-throw so http.ts can normalize.
    return Promise.reject(error);
  },
);
