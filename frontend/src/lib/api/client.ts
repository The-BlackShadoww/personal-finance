import type { ApiResponse } from "@/types/api";

let accessToken: string | null = null;
// Local-clock timestamp after which the access token should be renewed.
// Derived from the token's own lifetime (exp - iat) so a skewed device clock
// does not cause needless refreshes.
let accessTokenRenewAt = 0;
let refreshInFlight: Promise<boolean> | null = null;
let redirectingToLogin = false;

// Renew slightly early so a request never leaves with a token that expires
// while in flight.
const RENEW_BEFORE_EXPIRY_MS = 30_000;

// Endpoints that must not trigger a token refresh: they either establish the
// session themselves or report 401 as a normal result (wrong password).
const PUBLIC_ENDPOINTS = [
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/logout",
  "/auth/2fa/verify",
];

type ApiClientOptions = RequestInit & {
  retryOnUnauthorized?: boolean;
};

type ErrorResponse = {
  message?: string;
  error?: string;
};

type RefreshResponse =
  ApiResponse<{ accessToken: string }> | { accessToken: string };

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

export class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

export function setAccessToken(token: string) {
  accessToken = token;
  accessTokenRenewAt = Date.now() + getTokenLifetimeMs(token) - RENEW_BEFORE_EXPIRY_MS;
}

export function getAccessToken() {
  return accessToken;
}

export function clearAccessToken() {
  accessToken = null;
  accessTokenRenewAt = 0;
}

/**
 * Resolves once a usable access token is in memory, refreshing it first if it
 * is missing (fresh page load) or about to expire. Returns false when the
 * session cannot be restored.
 */
export async function ensureAccessToken() {
  if (accessToken && Date.now() < accessTokenRenewAt) {
    return true;
  }

  return refreshAccessToken();
}

export async function apiClient<T>(
  endpoint: string,
  options: ApiClientOptions = {},
): Promise<T> {
  const { retryOnUnauthorized = true, headers, ...requestOptions } = options;
  const requiresAuth = !isPublicEndpoint(endpoint);

  // The access token lives only in memory, so after a page load every request
  // would otherwise go out unauthenticated, get a 401, and refresh on its own.
  // Getting the token up front costs one shared refresh instead.
  if (requiresAuth && !(await ensureAccessToken())) {
    return handleUnauthorized();
  }

  const sentToken = accessToken;
  const response = await fetch(buildUrl(endpoint), {
    ...requestOptions,
    credentials: "include",
    headers: buildHeaders(headers),
  });

  if (response.status === 401 && requiresAuth && retryOnUnauthorized) {
    // Another request may already have renewed the token while this one was
    // in flight; only refresh if the token we sent is still the current one.
    const refreshed =
      accessToken !== null && accessToken !== sentToken
        ? true
        : await refreshAccessToken({ force: true });

    if (refreshed) {
      return apiClient<T>(endpoint, {
        ...options,
        retryOnUnauthorized: false,
      });
    }

    return handleUnauthorized();
  }

  if (!response.ok) {
    throw await createApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/**
 * Single-flight refresh: concurrent callers in this tab share one request, and
 * a Web Lock serialises refreshes across tabs. Refresh tokens rotate on every
 * use, so two tabs presenting the same cookie at once would otherwise trip the
 * server's reuse detection and revoke the session.
 */
function refreshAccessToken({ force = false } = {}): Promise<boolean> {
  refreshInFlight ??= runExclusive(async () => {
    // A refresh that finished in another tab doesn't help this tab (the access
    // token is per-tab memory), but one that finished in this tab while we
    // waited for the lock does.
    if (!force && accessToken && Date.now() < accessTokenRenewAt) {
      return true;
    }

    return requestNewAccessToken();
  }).finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

function runExclusive<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("auth-refresh", task) as Promise<T>;
  }

  return task();
}

async function handleUnauthorized(): Promise<never> {
  clearAccessToken();
  await redirectToLogin();
  throw new ApiError("Unauthorized", 401);
}

function isPublicEndpoint(endpoint: string) {
  const path = endpoint.split("?")[0];
  return PUBLIC_ENDPOINTS.some((publicPath) => path.endsWith(publicPath));
}

function getTokenLifetimeMs(token: string) {
  const FALLBACK_LIFETIME_MS = 60_000;

  try {
    const payloadSegment = token.split(".")[1];
    const payload = JSON.parse(
      atob(payloadSegment.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: number; iat?: number };

    if (typeof payload.exp === "number" && typeof payload.iat === "number") {
      return (payload.exp - payload.iat) * 1000;
    }
  } catch {
    // Unreadable payload: fall through and renew soon.
  }

  return FALLBACK_LIFETIME_MS;
}

async function requestNewAccessToken() {
  const response = await fetch(buildUrl("/auth/refresh"), {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return false;
  }

  const payload = (await response.json()) as RefreshResponse;
  const token = getRefreshToken(payload);

  if (!token) {
    return false;
  }

  setAccessToken(token);
  return true;
}

function getRefreshToken(payload: RefreshResponse) {
  if ("data" in payload) {
    return payload.data.accessToken;
  }

  return payload.accessToken;
}

export function buildUrl(endpoint: string) {
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }

  const baseUrl = API_BASE_URL.replace(/\/$/, "");
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  return `${baseUrl}${path}`;
}

function buildHeaders(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);

  nextHeaders.set("Accept", "application/json");

  if (accessToken) {
    nextHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  return nextHeaders;
}

async function createApiError(response: Response) {
  let message = response.statusText || "Request failed";

  try {
    const body = (await response.json()) as ErrorResponse;
    message = body.message ?? body.error ?? message;
  } catch {
    message = response.statusText || message;
  }

  return new ApiError(message, response.status);
}

async function redirectToLogin() {
  // Many requests can fail together; only the first should log out and navigate.
  if (typeof window !== "undefined" && !redirectingToLogin) {
    redirectingToLogin = true;
    await clearServerSession();
    window.location.assign("/login");
  }
}

async function clearServerSession() {
  try {
    await fetch(buildUrl("/auth/logout"), {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });
  } catch {
    // The redirect still moves the user out of the protected screen.
  }
}
