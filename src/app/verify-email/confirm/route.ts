import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { verifyEmailWithToken } from "@/lib/account-auth";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email") ?? "";
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const result = await verifyEmailWithToken({ email, token });
  const session = await auth();

  if (!result.ok) {
    return NextResponse.redirect(new URL("/verify-email?error=invalid", req.nextUrl.origin));
  }

  if (session?.user) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.redirect(new URL("/sign-in?verified=1", req.nextUrl.origin));
}
