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

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
