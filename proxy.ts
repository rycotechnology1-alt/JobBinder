import { auth } from "@/auth";
import { NextResponse } from "next/server";

const publicPaths = ["/sign-in", "/check-email"];

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  if (!req.auth && !isPublicPath) {
    return NextResponse.redirect(new URL("/sign-in", req.nextUrl.origin));
  }

  if (req.auth?.user && isPublicPath) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  if (
    req.auth?.user &&
    !req.auth.user.companyId &&
    !pathname.startsWith("/onboarding")
  ) {
    return NextResponse.redirect(new URL("/onboarding", req.nextUrl.origin));
  }

  if (
    req.auth?.user?.companyId &&
    pathname.startsWith("/onboarding")
  ) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
