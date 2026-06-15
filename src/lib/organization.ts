import { Role, type AccessPrincipalType, type MembershipStatus, type OrgUnitKind } from "@prisma/client";
import prisma from "@/lib/prisma";
import { createOneTimeToken } from "@/lib/auth-tokens";
import { sendInviteEmail } from "@/lib/auth-email";
import { normalizeInviteEmail } from "@/lib/auth-rules";
import { canManageMembership, isAccountManagerRole, type AccountRole } from "@/lib/account-access";
import { AccessError } from "@/lib/current-user";

export type OrganizationActor = {
  id: string;
  companyId: string;
  membershipId: string;
  role: AccountRole;
  company: { name: string };
};

const INVITE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function requireManagerRole(actor: OrganizationActor) {
  if (!isAccountManagerRole(actor.role)) {
    throw new AccessError(403, "Admin access required");
  }
}

export function normalizeRequiredText(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AccessError(400, `${fieldName} is required`);
  }

  return value.trim();
}

export function normalizeOptionalIdList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

async function assertIdsBelongToCompany(
  fieldName: string,
  ids: string[],
  lookup: (ids: string[]) => Promise<Array<{ id: string }>>,
) {
  if (ids.length === 0) return;

  const uniqueIds = Array.from(new Set(ids));
  const records = await lookup(uniqueIds);
  if (records.length !== uniqueIds.length) {
    throw new AccessError(404, `${fieldName} not found`);
  }
}

export async function getOrganizationSnapshot(actor: OrganizationActor) {
  requireManagerRole(actor);

  const [
    orgUnits,
    workspaces,
    crews,
    members,
    invites,
    workspaceAccessGrants,
    jobAccessGrants,
    jobs,
  ] = await Promise.all([
    prisma.orgUnit.findMany({
      where: { companyId: actor.companyId },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),
    prisma.workspace.findMany({
      where: { companyId: actor.companyId },
      orderBy: { name: "asc" },
      include: { orgUnit: { select: { id: true, name: true, kind: true } } },
    }),
    prisma.crew.findMany({
      where: { companyId: actor.companyId },
      orderBy: { name: "asc" },
      include: {
        orgUnit: { select: { id: true, name: true } },
        memberships: {
          include: {
            companyMembership: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        },
      },
    }),
    prisma.companyMembership.findMany({
      where: { companyId: actor.companyId },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      include: {
        user: { select: { id: true, name: true, email: true } },
        crewMemberships: { select: { crewId: true } },
        orgUnitMemberships: { select: { orgUnitId: true } },
      },
    }),
    prisma.invite.findMany({
      where: { companyId: actor.companyId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: {
        orgUnitAssignments: true,
        crewAssignments: true,
        workspaceAssignments: true,
      },
    }),
    prisma.workspaceAccessGrant.findMany({
      where: { companyId: actor.companyId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.jobAccessGrant.findMany({
      where: { companyId: actor.companyId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.job.findMany({
      where: { companyId: actor.companyId },
      orderBy: { title: "asc" },
      select: { id: true, title: true, workspaceId: true },
    }),
  ]);

  return {
    company: actor.company,
    role: actor.role,
    orgUnits,
    workspaces,
    crews,
    members,
    invites,
    workspaceAccessGrants,
    jobAccessGrants,
    jobs,
  };
}

export async function createOrgUnit(actor: OrganizationActor, input: { name: unknown; kind: unknown; parentOrgUnitId?: unknown }) {
  requireManagerRole(actor);
  const name = normalizeRequiredText(input.name, "Name");
  const kind: OrgUnitKind = input.kind === "COMPANY" ? "COMPANY" : "DIVISION";
  const parentOrgUnitId = typeof input.parentOrgUnitId === "string" && input.parentOrgUnitId.trim()
    ? input.parentOrgUnitId.trim()
    : null;

  return prisma.orgUnit.create({
    data: {
      companyId: actor.companyId,
      name,
      kind,
      parentOrgUnitId,
    },
  });
}

export async function createWorkspace(actor: OrganizationActor, input: { name: unknown; orgUnitId: unknown }) {
  requireManagerRole(actor);
  const name = normalizeRequiredText(input.name, "Name");
  const orgUnitId = normalizeRequiredText(input.orgUnitId, "Company or division");
  const orgUnit = await prisma.orgUnit.findFirst({
    where: { id: orgUnitId, companyId: actor.companyId },
    select: { id: true },
  });

  if (!orgUnit) throw new AccessError(404, "Company or division not found");

  return prisma.workspace.create({
    data: {
      companyId: actor.companyId,
      orgUnitId,
      name,
    },
  });
}

export async function createCrew(actor: OrganizationActor, input: { name: unknown; typeLabel: unknown; orgUnitId?: unknown }) {
  requireManagerRole(actor);
  const name = normalizeRequiredText(input.name, "Crew name");
  const typeLabel = normalizeRequiredText(input.typeLabel, "Crew type");
  const orgUnitId = typeof input.orgUnitId === "string" && input.orgUnitId.trim() ? input.orgUnitId.trim() : null;

  if (orgUnitId) {
    const orgUnit = await prisma.orgUnit.findFirst({
      where: { id: orgUnitId, companyId: actor.companyId },
      select: { id: true },
    });
    if (!orgUnit) throw new AccessError(404, "Company or division not found");
  }

  return prisma.crew.create({
    data: {
      companyId: actor.companyId,
      orgUnitId,
      name,
      typeLabel,
    },
  });
}

export async function updateCrew(actor: OrganizationActor, crewId: string, input: { name?: unknown; typeLabel?: unknown }) {
  requireManagerRole(actor);
  const data: { name?: string; typeLabel?: string } = {};
  if ("name" in input) data.name = normalizeRequiredText(input.name, "Crew name");
  if ("typeLabel" in input) data.typeLabel = normalizeRequiredText(input.typeLabel, "Crew type");

  const crew = await prisma.crew.findFirst({
    where: { id: crewId, companyId: actor.companyId },
    select: { id: true },
  });
  if (!crew) throw new AccessError(404, "Crew not found");

  return prisma.crew.update({ where: { id: crew.id }, data });
}

export async function setCrewMember(actor: OrganizationActor, crewId: string, input: { membershipId: unknown; action: unknown }) {
  requireManagerRole(actor);
  const membershipId = normalizeRequiredText(input.membershipId, "Member");
  const action = input.action === "remove" ? "remove" : "add";

  const [crew, membership] = await Promise.all([
    prisma.crew.findFirst({ where: { id: crewId, companyId: actor.companyId }, select: { id: true } }),
    prisma.companyMembership.findFirst({ where: { id: membershipId, companyId: actor.companyId }, select: { id: true } }),
  ]);

  if (!crew) throw new AccessError(404, "Crew not found");
  if (!membership) throw new AccessError(404, "Member not found");

  if (action === "remove") {
    await prisma.crewMembership.deleteMany({ where: { crewId, companyMembershipId: membershipId } });
    return { ok: true };
  }

  return prisma.crewMembership.upsert({
    where: { crewId_companyMembershipId: { crewId, companyMembershipId: membershipId } },
    create: { crewId, companyMembershipId: membershipId },
    update: {},
  });
}

export async function createAccessGrant(actor: OrganizationActor, input: {
  targetType: unknown;
  targetId: unknown;
  principalType: unknown;
  principalId: unknown;
}) {
  requireManagerRole(actor);
  const targetType = input.targetType === "JOB" ? "JOB" : "WORKSPACE";
  const targetId = normalizeRequiredText(input.targetId, "Target");
  const principalType = normalizeRequiredText(input.principalType, "Access type") as AccessPrincipalType;
  const principalId = normalizeRequiredText(input.principalId, "Access target");

  if (!["MEMBER", "CREW", "ORG_UNIT"].includes(principalType)) {
    throw new AccessError(400, "Invalid access type");
  }

  if (principalType === "MEMBER") {
    const membership = await prisma.companyMembership.findFirst({
      where: { id: principalId, companyId: actor.companyId, status: { not: "REMOVED" } },
      select: { id: true },
    });
    if (!membership) throw new AccessError(404, "Member not found");
  } else if (principalType === "CREW") {
    const crew = await prisma.crew.findFirst({
      where: { id: principalId, companyId: actor.companyId },
      select: { id: true },
    });
    if (!crew) throw new AccessError(404, "Crew not found");
  } else {
    const orgUnit = await prisma.orgUnit.findFirst({
      where: { id: principalId, companyId: actor.companyId },
      select: { id: true },
    });
    if (!orgUnit) throw new AccessError(404, "Company or division not found");
  }

  if (targetType === "JOB") {
    const job = await prisma.job.findFirst({ where: { id: targetId, companyId: actor.companyId }, select: { id: true } });
    if (!job) throw new AccessError(404, "Job not found");
    return prisma.jobAccessGrant.upsert({
      where: { jobId_principalType_principalId: { jobId: targetId, principalType, principalId } },
      create: { companyId: actor.companyId, jobId: targetId, principalType, principalId, createdByMembershipId: actor.membershipId },
      update: {},
    });
  }

  const workspace = await prisma.workspace.findFirst({ where: { id: targetId, companyId: actor.companyId }, select: { id: true } });
  if (!workspace) throw new AccessError(404, "Workspace not found");
  return prisma.workspaceAccessGrant.upsert({
    where: { workspaceId_principalType_principalId: { workspaceId: targetId, principalType, principalId } },
    create: { companyId: actor.companyId, workspaceId: targetId, principalType, principalId, createdByMembershipId: actor.membershipId },
    update: {},
  });
}

export async function deleteAccessGrant(actor: OrganizationActor, grantId: string) {
  requireManagerRole(actor);
  const [workspaceGrant, jobGrant] = await Promise.all([
    prisma.workspaceAccessGrant.findFirst({ where: { id: grantId, companyId: actor.companyId }, select: { id: true } }),
    prisma.jobAccessGrant.findFirst({ where: { id: grantId, companyId: actor.companyId }, select: { id: true } }),
  ]);

  if (workspaceGrant) {
    await prisma.workspaceAccessGrant.delete({ where: { id: workspaceGrant.id } });
    return { ok: true };
  }

  if (jobGrant) {
    await prisma.jobAccessGrant.delete({ where: { id: jobGrant.id } });
    return { ok: true };
  }

  throw new AccessError(404, "Access grant not found");
}

export async function createOrganizationInvite(actor: OrganizationActor, input: {
  email: unknown;
  role: unknown;
  orgUnitIds?: unknown;
  crewIds?: unknown;
  workspaceIds?: unknown;
}) {
  requireManagerRole(actor);
  const email = normalizeInviteEmail(normalizeRequiredText(input.email, "Email"));
  const role = input.role === "ADMIN" ? Role.ADMIN : Role.MEMBER;
  const expiresAt = new Date(Date.now() + INVITE_MAX_AGE_MS);
  const orgUnitIds = normalizeOptionalIdList(input.orgUnitIds);
  const crewIds = normalizeOptionalIdList(input.crewIds);
  const workspaceIds = normalizeOptionalIdList(input.workspaceIds);

  await Promise.all([
    assertIdsBelongToCompany("Company or division", orgUnitIds, (ids) =>
      prisma.orgUnit.findMany({ where: { id: { in: ids }, companyId: actor.companyId }, select: { id: true } }),
    ),
    assertIdsBelongToCompany("Crew", crewIds, (ids) =>
      prisma.crew.findMany({ where: { id: { in: ids }, companyId: actor.companyId }, select: { id: true } }),
    ),
    assertIdsBelongToCompany("Workspace", workspaceIds, (ids) =>
      prisma.workspace.findMany({ where: { id: { in: ids }, companyId: actor.companyId }, select: { id: true } }),
    ),
  ]);

  const invite = await prisma.invite.upsert({
    where: { companyId_email: { companyId: actor.companyId, email } },
    create: {
      companyId: actor.companyId,
      email,
      role,
      status: "PENDING",
      expiresAt,
      invitedByMembershipId: actor.membershipId,
    },
    update: {
      role,
      status: "PENDING",
      expiresAt,
      acceptedAt: null,
      canceledAt: null,
      invitedByMembershipId: actor.membershipId,
    },
  });

  await Promise.all([
    prisma.inviteOrgUnitAssignment.deleteMany({ where: { inviteId: invite.id } }),
    prisma.inviteCrewAssignment.deleteMany({ where: { inviteId: invite.id } }),
    prisma.inviteWorkspaceAssignment.deleteMany({ where: { inviteId: invite.id } }),
  ]);

  await Promise.all([
    ...orgUnitIds.map((orgUnitId) => prisma.inviteOrgUnitAssignment.create({ data: { inviteId: invite.id, orgUnitId } })),
    ...crewIds.map((crewId) => prisma.inviteCrewAssignment.create({ data: { inviteId: invite.id, crewId } })),
    ...workspaceIds.map((workspaceId) => prisma.inviteWorkspaceAssignment.create({ data: { inviteId: invite.id, workspaceId } })),
  ]);

  const token = await createOneTimeToken({
    prisma,
    purpose: "invite",
    key: invite.id,
    maxAgeMs: INVITE_MAX_AGE_MS,
  });

  await sendInviteEmail({
    email,
    inviteId: invite.id,
    token,
    companyName: actor.company.name,
  });

  return invite;
}

export async function resendOrganizationInvite(actor: OrganizationActor, inviteId: string) {
  requireManagerRole(actor);
  const invite = await prisma.invite.findFirst({
    where: { id: inviteId, companyId: actor.companyId, status: "PENDING", acceptedAt: null },
  });

  if (!invite) throw new AccessError(404, "Invite not found");

  const token = await createOneTimeToken({
    prisma,
    purpose: "invite",
    key: invite.id,
    maxAgeMs: INVITE_MAX_AGE_MS,
  });

  await sendInviteEmail({
    email: invite.email,
    inviteId: invite.id,
    token,
    companyName: actor.company.name,
  });

  return { ok: true };
}

export async function cancelOrganizationInvite(actor: OrganizationActor, inviteId: string) {
  requireManagerRole(actor);
  const invite = await prisma.invite.findFirst({
    where: { id: inviteId, companyId: actor.companyId, status: "PENDING" },
    select: { id: true },
  });

  if (!invite) throw new AccessError(404, "Invite not found");

  return prisma.invite.update({
    where: { id: invite.id },
    data: { status: "CANCELED", canceledAt: new Date() },
  });
}

export async function updateOrganizationMember(actor: OrganizationActor, membershipId: string, input: { role?: unknown; status?: unknown }) {
  requireManagerRole(actor);
  const target = await prisma.companyMembership.findFirst({
    where: { id: membershipId, companyId: actor.companyId },
    select: { id: true, role: true, status: true },
  });

  if (!target) throw new AccessError(404, "Member not found");

  const nextRole = input.role === "ADMIN" ? "ADMIN" : input.role === "MEMBER" ? "MEMBER" : undefined;
  const nextStatus = input.status === "DEACTIVATED" || input.status === "REMOVED" || input.status === "ACTIVE"
    ? input.status as MembershipStatus
    : undefined;

  if (!nextRole && !nextStatus) {
    throw new AccessError(400, "Role or status is required");
  }

  if (!canManageMembership({
    actorRole: actor.role,
    targetRole: target.role as AccountRole,
    nextRole: nextRole as AccountRole | undefined,
    nextStatus,
  })) {
    throw new AccessError(403, "Owner access required");
  }

  return prisma.companyMembership.update({
    where: { id: target.id },
    data: {
      ...(nextRole ? { role: nextRole } : {}),
      ...(nextStatus ? {
        status: nextStatus,
        deactivatedAt: nextStatus === "DEACTIVATED" ? new Date() : null,
        removedAt: nextStatus === "REMOVED" ? new Date() : null,
      } : {}),
    },
  });
}
