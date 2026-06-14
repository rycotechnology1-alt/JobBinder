import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export class AccessError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function getCurrentAppUser() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      company: true,
    },
  });
}

export async function requireCurrentUser() {
  const user = await getCurrentAppUser();

  if (!user) {
    throw new AccessError(401, "Not authenticated");
  }

  return user;
}

export async function requireCompanyUser() {
  const user = await requireCurrentUser();

  if (!user.emailVerified) {
    throw new AccessError(403, "Email verification required");
  }

  if (!user.companyId || !user.company) {
    throw new AccessError(409, "Company onboarding required");
  }

  return user as typeof user & {
    companyId: string;
    company: NonNullable<typeof user.company>;
  };
}

export async function requireAdminUser() {
  const user = await requireCompanyUser();

  if (user.role !== "ADMIN") {
    throw new AccessError(403, "Admin access required");
  }

  return user;
}

export async function requirePageCompanyUser() {
  const user = await getCurrentAppUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (!user.emailVerified) {
    redirect("/verify-email");
  }

  if (!user.companyId || !user.company) {
    redirect("/");
  }

  return user as typeof user & {
    companyId: string;
    company: NonNullable<typeof user.company>;
  };
}

export function accessErrorResponse(error: unknown) {
  if (error instanceof AccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return null;
}
