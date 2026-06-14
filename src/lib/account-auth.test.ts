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
      role: "ADMIN" | "MEMBER";
      hashedPassword: string | null;
      emailVerified: Date | null;
    }>,
    companies: [] as Array<{ id: string; name: string; plan: "FREE" | "PAID" }>,
    invites: [] as Array<{
      id: string;
      companyId: string;
      email: string;
      role: "ADMIN" | "MEMBER";
      expiresAt: Date;
      acceptedAt: Date | null;
    }>,
  };

  let userCount = 0;
  let companyCount = 0;

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
  it("creates an unverified admin and company, then sends verification", async () => {
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
        role: "ADMIN",
        hashedPassword: "hashed:Password1",
        emailVerified: null,
      },
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
      expiresAt: new Date("2026-06-14T11:00:00.000Z"),
      acceptedAt: null,
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
    expect(state.users[0].emailVerified).toBeInstanceOf(Date);
    expect(state.invites[0].acceptedAt).toBeInstanceOf(Date);
  });

  it("verifies an email address with a valid one-time token", async () => {
    const { state, deps } = createAccountAuthDeps();
    state.users.push({
      id: "user_1",
      email: "owner@example.com",
      name: "Owner",
      companyId: "company_1",
      role: "ADMIN",
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
