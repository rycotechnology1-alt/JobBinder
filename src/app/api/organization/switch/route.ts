import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { accessErrorResponse, AccessError, requireCurrentUser } from "@/lib/current-user";

const ACTIVE_COMPANY_COOKIE = "jobbinder.active-company-id";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const { companyId } = await req.json();

    if (!companyId || typeof companyId !== "string") {
      throw new AccessError(400, "Company is required");
    }

    const membership = await prisma.companyMembership.findFirst({
      where: { companyId, userId: user.id, status: "ACTIVE" },
      select: { companyId: true },
    });

    if (!membership) {
      throw new AccessError(404, "Company not found");
    }

    const response = NextResponse.json({ ok: true, companyId: membership.companyId });
    response.cookies.set(ACTIVE_COMPANY_COOKIE, membership.companyId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error switching organization:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
