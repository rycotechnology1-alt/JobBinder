import type { PlanType } from "@prisma/client";

export const FREE_PLAN_USER_LIMIT = 5;

type InviteLimitInput = {
  plan: PlanType;
  userCount: number;
};

type InviteLimitResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export function canInviteMoreUsers({
  plan,
  userCount,
}: InviteLimitInput): InviteLimitResult {
  if (plan === "FREE" && userCount >= FREE_PLAN_USER_LIMIT) {
    return {
      allowed: false,
      reason: `Free plan is limited to ${FREE_PLAN_USER_LIMIT} users.`,
    };
  }

  return { allowed: true };
}

export function normalizeInviteEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeAuthEmail(email: string) {
  return normalizeInviteEmail(email);
}

export function validatePassword(password: string) {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters.");
  }

  if (!/[a-zA-Z]/.test(password)) {
    errors.push("Password must include a letter.");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must include a number.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function getPostSignInPath(user: {
  companyId: string | null;
  emailVerified?: Date | string | null;
}) {
  if (!user.companyId) return "/";
  if (!user.emailVerified) return "/verify-email";
  return "/dashboard";
}
