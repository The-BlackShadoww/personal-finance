import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/account",
  "/goals",
  "/transactions",
  "/budgets",
  "/insights",
  "/review",
  "/reports",
  "/settings",
];
const authRoutes = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasRefreshToken = Boolean(request.cookies.get("refresh_token")?.value);
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route),
  );
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (isProtectedRoute && !hasRefreshToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);

    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && hasRefreshToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return withContentSecurityPolicy(request);
}

/**
 * Nonce-based Content-Security-Policy. Only scripts carrying this request's
 * nonce (Next.js adds it to its own tags; the root layout adds it to the theme
 * script) may run, so injected markup cannot execute script. `connect-src
 * 'self'` also stops anything that does run from sending data to another
 * origin with fetch/XHR. Requires pages to render per request (the root
 * layout reads the nonce, which makes every route dynamic).
 */
function withContentSecurityPolicy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV === "development";
  const policy = buildPolicy(nonce, {
    isDev,
    upgradeInsecureRequests: request.nextUrl.protocol === "https:",
  });

  // Next.js reads the nonce from the request's CSP header while rendering.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);

  return response;
}

function buildPolicy(
  nonce: string,
  { isDev, upgradeInsecureRequests }: { isDev: boolean; upgradeInsecureRequests: boolean },
) {
  const directives = [
    "default-src 'self'",
    // 'strict-dynamic' lets nonce'd scripts load the chunks they need.
    // React needs eval only in development (error overlays).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Style attributes rendered by React/framer-motion cannot carry a nonce,
    // so inline styles stay allowed. Fonts are self-hosted via next/font.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    // Profile avatars are user-supplied URLs on arbitrary HTTPS hosts.
    "img-src 'self' blob: data: https:",
    // API calls go through the same-origin /api/v1 rewrite. Dev adds the
    // hot-reload websocket.
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  if (upgradeInsecureRequests) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

export const config = {
  matcher: [
    {
      // Every page, but not API proxying, build assets or files with an
      // extension (images, fonts, favicon) — they need no CSP or auth check.
      source: "/((?!api|_next/static|_next/image|.*\\..*).*)",
      // Link prefetches fetch RSC payloads, not documents.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
