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

export function getPostSignInPath(user: { companyId: string | null }) {
  return user.companyId ? "/" : "/onboarding";
}
