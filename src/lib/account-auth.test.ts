import { describe, expect, it, vi } from "vitest";
import {
  acceptCompanyInvite,
  createCompanyAdminAccount,
  verifyEmailWithToken,
} from "./account-auth";

function createAccountAuthDeps() {
  const state = {
    users: [] as Array<{
      id: string;
      email: string;
      name: string | null;
      companyId: string | null;
      role: "OWNER" | "ADMIN" | "MEMBER";
      hashedPassword: string | null;
      emailVerified: Date | null;
    }>,
    companies: [] as Array<{ id: string; name: string; plan: "FREE" | "PAID" }>,
    memberships: [] as Array<{
      id: string;
      companyId: string;
      userId: string;
      role: "OWNER" | "ADMIN" | "MEMBER";
      status: "ACTIVE" | "DEACTIVATED" | "REMOVED";
    }>,
    orgUnits: [] as Array<{ id: string; companyId: string; name: string; kind: "COMPANY" | "DIVISION" }>,
    workspaces: [] as Array<{ id: string; companyId: string; orgUnitId: string; name: string }>,
    orgUnitMemberships: [] as Array<{ orgUnitId: string; companyMembershipId: string }>,
    crewMemberships: [] as Array<{ crewId: string; companyMembershipId: string }>,
    workspaceAccessGrants: [] as Array<{
      companyId: string;
      workspaceId: string;
      principalType: "MEMBER";
      principalId: string;
      createdByMembershipId: string | null;
    }>,
    invites: [] as Array<{
      id: string;
      companyId: string;
      email: string;
      role: "OWNER" | "ADMIN" | "MEMBER";
      status?: "PENDING" | "ACCEPTED" | "CANCELED" | "EXPIRED";
      expiresAt: Date;
      acceptedAt: Date | null;
      canceledAt?: Date | null;
      invitedByMembershipId?: string | null;
      orgUnitAssignments?: Array<{ orgUnitId: string }>;
      crewAssignments?: Array<{ crewId: string }>;
      workspaceAssignments?: Array<{ workspaceId: string }>;
    }>,
  };

  let userCount = 0;
  let companyCount = 0;
  let membershipCount = 0;
  let orgUnitCount = 0;
  let workspaceCount = 0;

  const tx = {
    user: {
      findUnique: vi.fn(async ({ where }) => {
        if ("email" in where) {
          return state.users.find((user) => user.email === where.email) ?? null;
        }
        return state.users.find((user) => user.id === where.id) ?? null;
      }),
      create: vi.fn(async ({ data }) => {
        const user = {
          id: `user_${++userCount}`,
          email: data.email,
          name: data.name ?? null,
          companyId: data.companyId ?? null,
          role: data.role ?? "MEMBER",
          hashedPassword: data.hashedPassword ?? null,
          emailVerified: data.emailVerified ?? null,
        };
        state.users.push(user);
        return user;
      }),
      update: vi.fn(async ({ where, data }) => {
        const user = state.users.find((candidate) =>
          "email" in where ? candidate.email === where.email : candidate.id === where.id,
        );
        if (!user) throw new Error("User not found");
        Object.assign(user, data);
        return user;
      }),
    },
    company: {
      create: vi.fn(async ({ data }) => {
        const company = {
          id: `company_${++companyCount}`,
          name: data.name,
          plan: data.plan ?? "FREE",
        };
        state.companies.push(company);
        return company;
      }),
    },
    companyMembership: {
      findUnique: vi.fn(async ({ where }) => {
        const key = where.companyId_userId;
        return state.memberships.find((membership) =>
          membership.companyId === key.companyId && membership.userId === key.userId,
        ) ?? null;
      }),
      create: vi.fn(async ({ data }) => {
        const membership = {
          id: `membership_${++membershipCount}`,
          companyId: data.companyId,
          userId: data.userId,
          role: data.role ?? "MEMBER",
          status: data.status ?? "ACTIVE",
        };
        state.memberships.push(membership);
        return membership;
      }),
      update: vi.fn(async ({ where, data }) => {
        const key = where.companyId_userId;
        const membership = state.memberships.find((candidate) =>
          candidate.companyId === key.companyId && candidate.userId === key.userId,
        );
        if (!membership) throw new Error("Membership not found");
        Object.assign(membership, data);
        return membership;
      }),
    },
    orgUnit: {
      create: vi.fn(async ({ data }) => {
        const orgUnit = {
          id: `org_${++orgUnitCount}`,
          companyId: data.companyId,
          name: data.name,
          kind: data.kind ?? "COMPANY",
        };
        state.orgUnits.push(orgUnit);
        return orgUnit;
      }),
    },
    orgUnitMembership: {
      createMany: vi.fn(async ({ data }) => {
        for (const membership of data) {
          if (!state.orgUnitMemberships.some((existing) =>
            existing.orgUnitId === membership.orgUnitId &&
            existing.companyMembershipId === membership.companyMembershipId,
          )) {
            state.orgUnitMemberships.push(membership);
          }
        }
        return { count: data.length };
      }),
    },
    crewMembership: {
      createMany: vi.fn(async ({ data }) => {
        for (const membership of data) {
          if (!state.crewMemberships.some((existing) =>
            existing.crewId === membership.crewId &&
            existing.companyMembershipId === membership.companyMembershipId,
          )) {
            state.crewMemberships.push(membership);
          }
        }
        return { count: data.length };
      }),
    },
    workspaceAccessGrant: {
      createMany: vi.fn(async ({ data }) => {
        for (const grant of data) {
          if (!state.workspaceAccessGrants.some((existing) =>
            existing.workspaceId === grant.workspaceId &&
            existing.principalType === grant.principalType &&
            existing.principalId === grant.principalId,
          )) {
            state.workspaceAccessGrants.push(grant);
          }
        }
        return { count: data.length };
      }),
    },
    workspace: {
      create: vi.fn(async ({ data }) => {
        const workspace = {
          id: `workspace_${++workspaceCount}`,
          companyId: data.companyId,
          orgUnitId: data.orgUnitId,
          name: data.name,
        };
        state.workspaces.push(workspace);
        return workspace;
      }),
    },
    invite: {
      findUnique: vi.fn(async ({ where }) => {
        return state.invites.find((invite) => invite.id === where.id) ?? null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const invite = state.invites.find((candidate) => candidate.id === where.id);
        if (!invite) throw new Error("Invite not found");
        Object.assign(invite, data);
        return invite;
      }),
    },
  };

  return {
    state,
    deps: {
      prisma: {
        ...tx,
        $transaction: vi.fn(async (callback) => callback(tx)),
      },
      hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
      createToken: vi.fn(async () => "token_123"),
      consumeToken: vi.fn(async () => true),
      sendVerificationEmail: vi.fn(async () => undefined),
    },
  };
}

describe("account auth service", () => {
  it("creates an unverified owner with a default company org unit and workspace, then sends verification", async () => {
    const { state, deps } = createAccountAuthDeps();

    const result = await createCompanyAdminAccount(
      {
        companyName: "Acme Construction",
        adminName: "Sam Builder",
        email: " OWNER@Example.COM ",
        password: "Password1",
        confirmPassword: "Password1",
      },
      deps,
    );

    expect(result).toEqual({ ok: true, email: "owner@example.com" });
    expect(state.companies).toEqual([
      { id: "company_1", name: "Acme Construction", plan: "FREE" },
    ]);
    expect(state.users).toMatchObject([
      {
        email: "owner@example.com",
        name: "Sam Builder",
        companyId: "company_1",
        role: "OWNER",
        hashedPassword: "hashed:Password1",
        emailVerified: null,
      },
    ]);
    expect(state.memberships).toEqual([
      {
        id: "membership_1",
        companyId: "company_1",
        userId: "user_1",
        role: "OWNER",
        status: "ACTIVE",
      },
    ]);
    expect(state.orgUnits).toEqual([
      { id: "org_1", companyId: "company_1", name: "Acme Construction", kind: "COMPANY" },
    ]);
    expect(state.workspaces).toEqual([
      { id: "workspace_1", companyId: "company_1", orgUnitId: "org_1", name: "Main Workspace" },
    ]);
    expect(deps.sendVerificationEmail).toHaveBeenCalledWith({
      email: "owner@example.com",
      token: "token_123",
    });
  });

  it("rejects duplicate signup emails without creating a company", async () => {
    const { state, deps } = createAccountAuthDeps();
    state.users.push({
      id: "user_existing",
      email: "owner@example.com",
      name: null,
      companyId: null,
      role: "MEMBER",
      hashedPassword: null,
      emailVerified: null,
    });

    const result = await createCompanyAdminAccount(
      {
        companyName: "Acme Construction",
        adminName: "Sam Builder",
        email: "owner@example.com",
        password: "Password1",
        confirmPassword: "Password1",
      },
      deps,
    );

    expect(result).toEqual({
      ok: false,
      message: "An account already exists for that email.",
    });
    expect(state.companies).toEqual([]);
  });

  it("accepts a valid invite by creating a verified employee with a password", async () => {
    const { state, deps } = createAccountAuthDeps();
    state.invites.push({
      id: "invite_123",
      companyId: "company_1",
      email: "crew@example.com",
      role: "MEMBER",
      status: "PENDING",
      expiresAt: new Date("2026-06-14T11:00:00.000Z"),
      acceptedAt: null,
      canceledAt: null,
    });

    const result = await acceptCompanyInvite(
      {
        inviteId: "invite_123",
        token: "raw_token",
        name: "Crew Member",
        password: "Password1",
        confirmPassword: "Password1",
        now: new Date("2026-06-14T10:00:00.000Z"),
      },
      deps,
    );

    expect(result).toEqual({ ok: true, email: "crew@example.com" });
    expect(deps.consumeToken).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: "invite",
        key: "invite_123",
        token: "raw_token",
        now: new Date("2026-06-14T10:00:00.000Z"),
      }),
    );
    expect(state.users).toMatchObject([
      {
        email: "crew@example.com",
        name: "Crew Member",
        companyId: "company_1",
        role: "MEMBER",
        hashedPassword: "hashed:Password1",
      },
    ]);
    expect(state.memberships).toEqual([
      {
        id: "membership_1",
        companyId: "company_1",
        userId: "user_1",
        role: "MEMBER",
        status: "ACTIVE",
      },
    ]);
    expect(state.users[0].emailVerified).toBeInstanceOf(Date);
    expect(state.invites[0].acceptedAt).toBeInstanceOf(Date);
    expect(state.invites[0].status).toBe("ACCEPTED");
  });

  it("lets an existing email join a second company account from an invite", async () => {
    const { state, deps } = createAccountAuthDeps();
    state.users.push({
      id: "user_existing",
      email: "crew@example.com",
      name: "Crew Member",
      companyId: "company_1",
      role: "MEMBER",
      hashedPassword: "hashed:OldPassword1",
      emailVerified: new Date("2026-06-01T10:00:00.000Z"),
    });
    state.memberships.push({
      id: "membership_existing",
      companyId: "company_1",
      userId: "user_existing",
      role: "MEMBER",
      status: "ACTIVE",
    });
    state.invites.push({
      id: "invite_456",
      companyId: "company_2",
      email: "crew@example.com",
      role: "ADMIN",
      status: "PENDING",
      expiresAt: new Date("2026-06-14T11:00:00.000Z"),
      acceptedAt: null,
      canceledAt: null,
    });

    const result = await acceptCompanyInvite(
      {
        inviteId: "invite_456",
        token: "raw_token",
        name: "Crew Member",
        password: "Password1",
        confirmPassword: "Password1",
        now: new Date("2026-06-14T10:00:00.000Z"),
      },
      deps,
    );

    expect(result).toEqual({ ok: true, email: "crew@example.com" });
    expect(state.users).toHaveLength(1);
    expect(state.memberships).toContainEqual({
      id: "membership_1",
      companyId: "company_2",
      userId: "user_existing",
      role: "ADMIN",
      status: "ACTIVE",
    });
    expect(state.invites[0].status).toBe("ACCEPTED");
  });

  it("applies invite assignments after creating a membership", async () => {
    const { state, deps } = createAccountAuthDeps();
    state.invites.push({
      id: "invite_789",
      companyId: "company_1",
      email: "crew@example.com",
      role: "MEMBER",
      status: "PENDING",
      expiresAt: new Date("2026-06-14T11:00:00.000Z"),
      acceptedAt: null,
      canceledAt: null,
      invitedByMembershipId: "membership_owner",
      orgUnitAssignments: [{ orgUnitId: "org_1" }],
      crewAssignments: [{ crewId: "crew_1" }],
      workspaceAssignments: [{ workspaceId: "workspace_1" }],
    });

    const result = await acceptCompanyInvite(
      {
        inviteId: "invite_789",
        token: "raw_token",
        name: "Crew Member",
        password: "Password1",
        confirmPassword: "Password1",
        now: new Date("2026-06-14T10:00:00.000Z"),
      },
      deps,
    );

    expect(result).toEqual({ ok: true, email: "crew@example.com" });
    expect(state.orgUnitMemberships).toEqual([
      { orgUnitId: "org_1", companyMembershipId: "membership_1" },
    ]);
    expect(state.crewMemberships).toEqual([
      { crewId: "crew_1", companyMembershipId: "membership_1" },
    ]);
    expect(state.workspaceAccessGrants).toEqual([
      {
        companyId: "company_1",
        workspaceId: "workspace_1",
        principalType: "MEMBER",
        principalId: "membership_1",
        createdByMembershipId: "membership_owner",
      },
    ]);
  });

  it("rejects canceled invites before consuming the token", async () => {
    const { state, deps } = createAccountAuthDeps();
    state.invites.push({
      id: "invite_canceled",
      companyId: "company_1",
      email: "crew@example.com",
      role: "MEMBER",
      status: "CANCELED",
      expiresAt: new Date("2026-06-14T11:00:00.000Z"),
      acceptedAt: null,
      canceledAt: new Date("2026-06-14T09:00:00.000Z"),
    });

    const result = await acceptCompanyInvite(
      {
        inviteId: "invite_canceled",
        token: "raw_token",
        name: "Crew Member",
        password: "Password1",
        confirmPassword: "Password1",
        now: new Date("2026-06-14T10:00:00.000Z"),
      },
      deps,
    );

    expect(result).toEqual({ ok: false, message: "This invite is invalid or expired." });
    expect(deps.consumeToken).not.toHaveBeenCalled();
    expect(state.memberships).toEqual([]);
  });

  it("verifies an email address with a valid one-time token", async () => {
    const { state, deps } = createAccountAuthDeps();
    state.users.push({
      id: "user_1",
      email: "owner@example.com",
      name: "Owner",
      companyId: "company_1",
      role: "OWNER",
      hashedPassword: "hashed:Password1",
      emailVerified: null,
    });

    const result = await verifyEmailWithToken(
      {
        email: " OWNER@Example.COM ",
        token: "raw_token",
        now: new Date("2026-06-14T10:00:00.000Z"),
      },
      deps,
    );

    expect(result).toEqual({ ok: true, email: "owner@example.com" });
    expect(deps.consumeToken).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: "email-verify",
        key: "owner@example.com",
        token: "raw_token",
      }),
    );
    expect(state.users[0].emailVerified).toBeInstanceOf(Date);
  });
});
