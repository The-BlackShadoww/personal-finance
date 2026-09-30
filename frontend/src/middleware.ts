import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/account",
  "/transactions",
  "/budgets",
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/account/:path*",
    "/transactions/:path*",
    "/budgets/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/login",
    "/register",
  ],
};
