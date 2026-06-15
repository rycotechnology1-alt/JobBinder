import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  createOneTimeToken,
  consumeOneTimeToken,
  type VerificationTokenClient,
} from "@/lib/auth-tokens";
import { hashPassword as defaultHashPassword } from "@/lib/auth-password";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/lib/auth-email";
import { normalizeAuthEmail, validatePassword } from "@/lib/auth-rules";

const EMAIL_VERIFICATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_MAX_AGE_MS = 60 * 60 * 1000;

type AccountAuthDeps = {
  prisma: AccountAuthPrisma;
  hashPassword: (password: string) => Promise<string>;
  createToken: typeof createOneTimeToken;
  consumeToken: typeof consumeOneTimeToken;
  sendVerificationEmail: typeof sendVerificationEmail;
  sendPasswordResetEmail?: typeof sendPasswordResetEmail;
};

type UserRecord = {
  id: string;
  email?: string | null;
  companyId?: string | null;
  role?: Role;
};

type CompanyRecord = {
  id: string;
};

type InviteRecord = {
  id: string;
  companyId: string;
  email: string;
  role: Role;
  status?: "PENDING" | "ACCEPTED" | "CANCELED" | "EXPIRED";
  expiresAt: Date;
  acceptedAt: Date | null;
  canceledAt?: Date | null;
  invitedByMembershipId?: string | null;
  orgUnitAssignments?: Array<{ orgUnitId: string }>;
  crewAssignments?: Array<{ crewId: string }>;
  workspaceAssignments?: Array<{ workspaceId: string }>;
};

type AccountAuthDataClient = {
  user: {
    findUnique(args: object): Promise<UserRecord | null>;
    create(args: object): Promise<UserRecord>;
    update(args: object): Promise<UserRecord>;
  };
  company: {
    create(args: object): Promise<CompanyRecord>;
  };
  companyMembership: {
    findUnique(args: object): Promise<{ id: string; companyId: string; userId: string; role: Role; status: string } | null>;
    create(args: object): Promise<{ id: string; companyId: string; userId: string; role: Role; status: string }>;
    update(args: object): Promise<{ id: string; companyId: string; userId: string; role: Role; status: string }>;
  };
  orgUnitMembership: {
    createMany(args: object): Promise<{ count: number }>;
  };
  crewMembership: {
    createMany(args: object): Promise<{ count: number }>;
  };
  workspaceAccessGrant: {
    createMany(args: object): Promise<{ count: number }>;
  };
  orgUnit: {
    create(args: object): Promise<{ id: string; companyId: string }>;
  };
  workspace: {
    create(args: object): Promise<{ id: string; companyId: string; orgUnitId: string }>;
  };
  invite: {
    findUnique(args: object): Promise<InviteRecord | null>;
    update(args: object): Promise<InviteRecord>;
  };
};

type AccountAuthPrisma = AccountAuthDataClient &
  VerificationTokenClient & {
    $transaction<T>(callback: (tx: AccountAuthDataClient) => Promise<T>): Promise<T>;
  };

type AuthServiceResult =
  | { ok: true; email: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

const defaultDeps: AccountAuthDeps = {
  prisma: prisma as unknown as AccountAuthPrisma,
  hashPassword: defaultHashPassword,
  createToken: createOneTimeToken,
  consumeToken: consumeOneTimeToken,
  sendVerificationEmail,
  sendPasswordResetEmail,
};

function validatePasswordPair(password: string, confirmPassword: string) {
  const passwordResult = validatePassword(password);
  const fieldErrors: Record<string, string> = {};

  if (!passwordResult.valid) {
    fieldErrors.password = passwordResult.errors[0];
  }

  if (password !== confirmPassword) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }

  return fieldErrors;
}

export async function createCompanyAdminAccount(
  input: {
    companyName: string;
    adminName: string;
    email: string;
    password: string;
    confirmPassword: string;
  },
  deps: AccountAuthDeps = defaultDeps,
): Promise<AuthServiceResult> {
  const companyName = input.companyName.trim();
  const adminName = input.adminName.trim();
  const email = normalizeAuthEmail(input.email);
  const fieldErrors: Record<string, string> = {};

  if (!companyName) fieldErrors.companyName = "Company name is required.";
  if (!adminName) fieldErrors.adminName = "Your name is required.";
  if (!email) fieldErrors.email = "Email is required.";
  Object.assign(fieldErrors, validatePasswordPair(input.password, input.confirmPassword));

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };
  }

  const existingUser = await deps.prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    return { ok: false, message: "An account already exists for that email." };
  }

  const hashedPassword = await deps.hashPassword(input.password);

  await deps.prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: companyName,
        plan: "FREE",
      },
    });

    const owner = await tx.user.create({
      data: {
        email,
        name: adminName,
        hashedPassword,
        emailVerified: null,
        companyId: company.id,
        role: Role.OWNER,
      },
    });

    await tx.companyMembership.create({
      data: {
        companyId: company.id,
        userId: owner.id,
        role: Role.OWNER,
        status: "ACTIVE",
      },
    });

    const orgUnit = await tx.orgUnit.create({
      data: {
        companyId: company.id,
        name: companyName,
        kind: "COMPANY",
      },
    });

    await tx.workspace.create({
      data: {
        companyId: company.id,
        orgUnitId: orgUnit.id,
        name: "Main Workspace",
      },
    });
  });

  const token = await deps.createToken({
    prisma: deps.prisma,
    purpose: "email-verify",
    key: email,
    maxAgeMs: EMAIL_VERIFICATION_MAX_AGE_MS,
  });

  await deps.sendVerificationEmail({ email, token });

  return { ok: true, email };
}

export async function acceptCompanyInvite(
  input: {
    inviteId: string;
    token: string;
    name: string;
    password: string;
    confirmPassword: string;
    now?: Date;
  },
  deps: AccountAuthDeps = defaultDeps,
): Promise<AuthServiceResult> {
  const now = input.now ?? new Date();
  const name = input.name.trim();
  const fieldErrors = validatePasswordPair(input.password, input.confirmPassword);

  if (!name) fieldErrors.name = "Your name is required.";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };
  }

  const invite = await deps.prisma.invite.findUnique({
    where: { id: input.inviteId },
    include: {
      orgUnitAssignments: { select: { orgUnitId: true } },
      crewAssignments: { select: { crewId: true } },
      workspaceAssignments: { select: { workspaceId: true } },
    },
  });

  if (
    !invite ||
    invite.acceptedAt ||
    invite.canceledAt ||
    invite.status === "CANCELED" ||
    invite.status === "ACCEPTED" ||
    invite.expiresAt.getTime() <= now.getTime()
  ) {
    return { ok: false, message: "This invite is invalid or expired." };
  }

  const validToken = await deps.consumeToken({
    purpose: "invite",
    key: invite.id,
    token: input.token,
    now,
    prisma: deps.prisma,
  });

  if (!validToken) {
    return { ok: false, message: "This invite is invalid or expired." };
  }

  const hashedPassword = await deps.hashPassword(input.password);

  await deps.prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { email: invite.email },
    });

    let userId: string;
    if (existingUser) {
      const updatedUser = await tx.user.update({
        where: { id: existingUser.id },
        data: {
          name,
          hashedPassword,
          companyId: existingUser.companyId ?? invite.companyId,
          role: existingUser.role ?? invite.role,
          emailVerified: now,
        },
      });
      userId = updatedUser.id;
    } else {
      const createdUser = await tx.user.create({
        data: {
          email: invite.email,
          name,
          hashedPassword,
          companyId: invite.companyId,
          role: invite.role,
          emailVerified: now,
        },
      });
      userId = createdUser.id;
    }

    const existingMembership = await tx.companyMembership.findUnique({
      where: {
        companyId_userId: {
          companyId: invite.companyId,
          userId,
        },
      },
    });

    const membership = existingMembership
      ? await tx.companyMembership.update({
        where: {
          companyId_userId: {
            companyId: invite.companyId,
            userId,
          },
        },
        data: {
          role: invite.role,
          status: "ACTIVE",
          deactivatedAt: null,
          removedAt: null,
        },
      })
      : await tx.companyMembership.create({
        data: {
          companyId: invite.companyId,
          userId,
          role: invite.role,
          status: "ACTIVE",
        },
      });

    const orgUnitAssignments = invite.orgUnitAssignments ?? [];
    const crewAssignments = invite.crewAssignments ?? [];
    const workspaceAssignments = invite.workspaceAssignments ?? [];

    if (orgUnitAssignments.length > 0) {
      await tx.orgUnitMembership.createMany({
        data: orgUnitAssignments.map((assignment) => ({
          orgUnitId: assignment.orgUnitId,
          companyMembershipId: membership.id,
        })),
        skipDuplicates: true,
      });
    }

    if (crewAssignments.length > 0) {
      await tx.crewMembership.createMany({
        data: crewAssignments.map((assignment) => ({
          crewId: assignment.crewId,
          companyMembershipId: membership.id,
        })),
        skipDuplicates: true,
      });
    }

    if (workspaceAssignments.length > 0) {
      await tx.workspaceAccessGrant.createMany({
        data: workspaceAssignments.map((assignment) => ({
          companyId: invite.companyId,
          workspaceId: assignment.workspaceId,
          principalType: "MEMBER",
          principalId: membership.id,
          createdByMembershipId: invite.invitedByMembershipId ?? null,
        })),
        skipDuplicates: true,
      });
    }

    await tx.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: now, status: "ACCEPTED" },
    });
  });

  return { ok: true, email: invite.email };
}

export async function requestPasswordSetupEmail(
  emailInput: string,
  deps: AccountAuthDeps = defaultDeps,
) {
  const email = normalizeAuthEmail(emailInput);
  const user = await deps.prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (user && deps.sendPasswordResetEmail) {
    const token = await deps.createToken({
      prisma: deps.prisma,
      purpose: "password-reset",
      key: email,
      maxAgeMs: PASSWORD_RESET_MAX_AGE_MS,
    });
    await deps.sendPasswordResetEmail({ email, token });
  }

  return { ok: true as const, email };
}

export async function resetPasswordWithToken(
  input: {
    email: string;
    token: string;
    password: string;
    confirmPassword: string;
    now?: Date;
  },
  deps: AccountAuthDeps = defaultDeps,
): Promise<AuthServiceResult> {
  const email = normalizeAuthEmail(input.email);
  const fieldErrors = validatePasswordPair(input.password, input.confirmPassword);

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };
  }

  const validToken = await deps.consumeToken({
    prisma: deps.prisma,
    purpose: "password-reset",
    key: email,
    token: input.token,
    now: input.now ?? new Date(),
  });

  if (!validToken) {
    return { ok: false, message: "This password setup link is invalid or expired." };
  }

  await deps.prisma.user.update({
    where: { email },
    data: {
      hashedPassword: await deps.hashPassword(input.password),
    },
  });

  return { ok: true, email };
}

export async function sendEmailVerificationForUser(
  emailInput: string,
  deps: AccountAuthDeps = defaultDeps,
) {
  const email = normalizeAuthEmail(emailInput);
  const token = await deps.createToken({
    prisma: deps.prisma,
    purpose: "email-verify",
    key: email,
    maxAgeMs: EMAIL_VERIFICATION_MAX_AGE_MS,
  });

  await deps.sendVerificationEmail({ email, token });
  return { ok: true as const, email };
}

export async function verifyEmailWithToken(
  input: {
    email: string;
    token: string;
    now?: Date;
  },
  deps: AccountAuthDeps = defaultDeps,
): Promise<AuthServiceResult> {
  const email = normalizeAuthEmail(input.email);
  const now = input.now ?? new Date();
  const validToken = await deps.consumeToken({
    prisma: deps.prisma,
    purpose: "email-verify",
    key: email,
    token: input.token,
    now,
  });

  if (!validToken) {
    return { ok: false, message: "This verification link is invalid or expired." };
  }

  await deps.prisma.user.update({
    where: { email },
    data: { emailVerified: now },
  });

  return { ok: true, email };
}
