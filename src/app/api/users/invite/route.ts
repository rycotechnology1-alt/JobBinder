import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { signIn } from "@/auth";
import { canInviteMoreUsers, normalizeInviteEmail } from "@/lib/auth-rules";
import {
  accessErrorResponse,
  requireAdminUser,
} from "@/lib/current-user";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdminUser();
    const { email, role } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const inviteRole = role === "ADMIN" ? Role.ADMIN : Role.MEMBER;
    const normalizedEmail = normalizeInviteEmail(email);
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      include: { _count: { select: { users: true } } },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const pendingInviteCount = await prisma.invite.count({
      where: {
        companyId: user.companyId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
        email: { not: normalizedEmail },
      },
    });

    const inviteLimit = canInviteMoreUsers({
      plan: company.plan,
      userCount: company._count.users,
    });

    if (!inviteLimit.allowed) {
      return NextResponse.json({ error: inviteLimit.reason }, { status: 403 });
    }

    const totalSeatsAfterInvite = company._count.users + pendingInviteCount;
    const pendingLimit = canInviteMoreUsers({
      plan: company.plan,
      userCount: totalSeatsAfterInvite,
    });

    if (!pendingLimit.allowed) {
      return NextResponse.json({ error: pendingLimit.reason }, { status: 403 });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.invite.upsert({
      where: {
        companyId_email: {
          companyId: user.companyId,
          email: normalizedEmail,
        },
      },
      create: {
        companyId: user.companyId,
        email: normalizedEmail,
        role: inviteRole,
        expiresAt,
      },
      update: {
        role: inviteRole,
        expiresAt,
        acceptedAt: null,
      },
    });

    await signIn("resend", {
      email: normalizedEmail,
      redirect: false,
      redirectTo: "/",
    });

    return NextResponse.json({
      success: true,
      message: "Invite email sent",
    });

  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error sending invite:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
