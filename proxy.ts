import { auth } from "@/auth";
import { NextResponse } from "next/server";

const publicPathPrefixes = [
  "/sign-in",
  "/verify-email",
  "/password-reset",
  "/invite/accept",
  "/check-email",
];

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublicPath =
    pathname === "/" ||
    publicPathPrefixes.some((path) => pathname.startsWith(path));

  if (!req.auth && !isPublicPath) {
    return NextResponse.redirect(new URL("/sign-in", req.nextUrl.origin));
  }

  if (
    req.auth?.user &&
    !req.auth.user.emailVerified &&
    !pathname.startsWith("/verify-email")
  ) {
    return NextResponse.redirect(new URL("/verify-email", req.nextUrl.origin));
  }

  if (
    req.auth?.user &&
    req.auth.user.emailVerified &&
    req.auth.user.hasActiveMembership &&
    (pathname === "/" ||
      pathname.startsWith("/sign-in") ||
      pathname.startsWith("/password-reset") ||
      pathname.startsWith("/invite/accept") ||
      pathname.startsWith("/verify-email") ||
      pathname.startsWith("/check-email") ||
      pathname.startsWith("/onboarding"))
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  if (
    req.auth?.user?.emailVerified &&
    !req.auth.user.hasActiveMembership &&
    !isPublicPath
  ) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
