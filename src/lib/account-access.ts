import type { Prisma } from "@prisma/client";

export type AccountRole = "OWNER" | "ADMIN" | "MEMBER";
export type AccountMembershipStatus = "ACTIVE" | "DEACTIVATED" | "REMOVED";
export type AccessPrincipalType = "MEMBER" | "CREW" | "ORG_UNIT";

type ManageMembershipInput = {
  actorRole: AccountRole;
  targetRole: AccountRole;
  nextRole?: AccountRole;
  nextStatus?: AccountMembershipStatus;
};

export type AccessibleJobContext = {
  companyId: string;
  membershipId: string;
  role: AccountRole;
  crewIds?: string[];
  orgUnitIds?: string[];
};

export function isAccountManagerRole(role: AccountRole) {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageMembership({
  actorRole,
  targetRole,
  nextRole,
  nextStatus,
}: ManageMembershipInput) {
  if (!isAccountManagerRole(actorRole)) return false;
  if (nextRole === "OWNER") return false;

  const targetIsAdmin = targetRole === "OWNER" || targetRole === "ADMIN";
  const adminProtectedChange =
    targetIsAdmin &&
    (Boolean(nextStatus) || (Boolean(nextRole) && nextRole !== targetRole));

  if (adminProtectedChange && actorRole !== "OWNER") return false;
  if (targetRole === "OWNER" && actorRole !== "OWNER") return false;

  return true;
}

function memberGrant(principalType: AccessPrincipalType, principalId: string | { in: string[] }): Prisma.JobWhereInput {
  return {
    accessGrants: {
      some: {
        principalType,
        principalId,
      },
    },
  };
}

function workspaceGrant(principalType: AccessPrincipalType, principalId: string | { in: string[] }): Prisma.JobWhereInput {
  return {
    workspace: {
      accessGrants: {
        some: {
          principalType,
          principalId,
        },
      },
    },
  };
}

export function buildAccessibleJobWhere(context: AccessibleJobContext): Prisma.JobWhereInput {
  if (isAccountManagerRole(context.role)) {
    return { companyId: context.companyId };
  }

  const crewIds = context.crewIds ?? [];
  const orgUnitIds = context.orgUnitIds ?? [];
  const OR: Prisma.JobWhereInput[] = [
    memberGrant("MEMBER", context.membershipId),
    workspaceGrant("MEMBER", context.membershipId),
  ];

  if (crewIds.length > 0) {
    OR.push(
      memberGrant("CREW", { in: crewIds }),
      workspaceGrant("CREW", { in: crewIds }),
    );
  }

  if (orgUnitIds.length > 0) {
    OR.push(
      memberGrant("ORG_UNIT", { in: orgUnitIds }),
      workspaceGrant("ORG_UNIT", { in: orgUnitIds }),
    );
  }

  return {
    companyId: context.companyId,
    OR,
  };
}
