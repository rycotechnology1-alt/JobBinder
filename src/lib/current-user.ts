import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import {
  buildAccessibleJobWhere,
  isAccountManagerRole,
  type AccountRole,
} from "@/lib/account-access";

export class AccessError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const ACTIVE_COMPANY_COOKIE = "jobbinder.active-company-id";

type ActiveMembership = NonNullable<Awaited<ReturnType<typeof findCurrentUserWithMemberships>>>["memberships"][number];

async function getActiveCompanyIdCookie() {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

async function findCurrentUserWithMemberships() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      company: true,
      memberships: {
        where: { status: "ACTIVE" },
        orderBy: { joinedAt: "asc" },
        include: {
          company: true,
          crewMemberships: { select: { crewId: true } },
          orgUnitMemberships: { select: { orgUnitId: true } },
        },
      },
    },
  });
}

function pickActiveMembership(memberships: ActiveMembership[], activeCompanyId: string | null) {
  if (activeCompanyId) {
    const matchingMembership = memberships.find((membership) => membership.companyId === activeCompanyId);
    if (matchingMembership) return matchingMembership;
  }

  return memberships[0] ?? null;
}

function toAccountUser(
  user: NonNullable<Awaited<ReturnType<typeof findCurrentUserWithMemberships>>>,
  membership: ActiveMembership | null,
) {
  return {
    ...user,
    companyId: membership?.companyId ?? null,
    company: membership?.company ?? null,
    role: (membership?.role ?? user.role) as AccountRole,
    membershipId: membership?.id ?? null,
    membership,
    crewIds: membership?.crewMemberships.map((crewMembership) => crewMembership.crewId) ?? [],
    orgUnitIds: membership?.orgUnitMemberships.map((orgUnitMembership) => orgUnitMembership.orgUnitId) ?? [],
    memberships: user.memberships,
  };
}

export async function getCurrentAccountContext() {
  const user = await findCurrentUserWithMemberships();
  if (!user) return null;

  const activeCompanyId = await getActiveCompanyIdCookie();
  const membership = pickActiveMembership(user.memberships, activeCompanyId);

  return toAccountUser(user, membership);
}

export async function getCurrentAppUser() {
  return getCurrentAccountContext();
}

export async function requireCurrentUser() {
  const user = await getCurrentAccountContext();

  if (!user) {
    throw new AccessError(401, "Not authenticated");
  }

  return user;
}

export async function requireAccountUser() {
  const user = await requireCurrentUser();

  if (!user.emailVerified) {
    throw new AccessError(403, "Email verification required");
  }

  if (!user.companyId || !user.company || !user.membershipId || !user.membership) {
    throw new AccessError(409, "Company onboarding required");
  }

  return user as typeof user & {
    companyId: string;
    company: NonNullable<typeof user.company>;
    membershipId: string;
    membership: NonNullable<typeof user.membership>;
  };
}

export async function requireAccountManager() {
  const user = await requireAccountUser();

  if (!isAccountManagerRole(user.role)) {
    throw new AccessError(403, "Admin access required");
  }

  return user;
}

export async function requireOwner() {
  const user = await requireAccountUser();

  if (user.role !== "OWNER") {
    throw new AccessError(403, "Owner access required");
  }

  return user;
}

export async function requirePageAccountUser() {
  const user = await getCurrentAccountContext();

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
    membershipId: string;
    membership: NonNullable<typeof user.membership>;
  };
}

export async function requireJobAccess(jobId: string) {
  const user = await requireAccountUser();
  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      ...buildAccessibleJobWhere({
        companyId: user.companyId,
        membershipId: user.membershipId,
        role: user.role,
        crewIds: user.crewIds,
        orgUnitIds: user.orgUnitIds,
      }),
    },
    select: { id: true, companyId: true, workspaceId: true },
  });

  if (!job) {
    throw new AccessError(404, "Job not found");
  }

  return { user, job };
}

export async function requireJobManager(jobId: string) {
  const user = await requireAccountManager();
  const job = await prisma.job.findFirst({
    where: { id: jobId, companyId: user.companyId },
    select: { id: true, companyId: true, workspaceId: true },
  });

  if (!job) {
    throw new AccessError(404, "Job not found");
  }

  return { user, job };
}

export async function requireFileAccess(fileId: string) {
  const user = await requireAccountUser();
  const file = await prisma.file.findFirst({
    where: { id: fileId, companyId: user.companyId },
    select: {
      id: true,
      jobId: true,
      uploaderId: true,
    },
  });

  if (!file) {
    throw new AccessError(404, "File not found");
  }

  if (!file.jobId) {
    if (isAccountManagerRole(user.role) || file.uploaderId === user.id) {
      return { user, file };
    }
    throw new AccessError(404, "File not found");
  }

  const job = await prisma.job.findFirst({
    where: {
      id: file.jobId,
      ...buildAccessibleJobWhere({
        companyId: user.companyId,
        membershipId: user.membershipId,
        role: user.role,
        crewIds: user.crewIds,
        orgUnitIds: user.orgUnitIds,
      }),
    },
    select: { id: true },
  });

  if (!job) {
    throw new AccessError(404, "File not found");
  }

  return { user, file };
}

export const requireCompanyUser = requireAccountUser;
export const requireAdminUser = requireAccountManager;
export const requirePageCompanyUser = requirePageAccountUser;

export function accessErrorResponse(error: unknown) {
  if (error instanceof AccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return null;
}
