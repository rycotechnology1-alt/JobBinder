import { describe, expect, it } from "vitest";
import {
  canInviteMoreUsers,
  getPostSignInPath,
  normalizeAuthEmail,
  normalizeInviteEmail,
  validatePassword,
} from "./auth-rules";

describe("auth access rules", () => {
  it("allows free companies to invite up to five users", () => {
    expect(canInviteMoreUsers({ plan: "FREE", userCount: 4 })).toEqual({
      allowed: true,
    });
    expect(canInviteMoreUsers({ plan: "FREE", userCount: 5 })).toEqual({
      allowed: false,
      reason: "Free plan is limited to 5 users.",
    });
  });

  it("does not cap paid companies at five users", () => {
    expect(canInviteMoreUsers({ plan: "PAID", userCount: 8 })).toEqual({
      allowed: true,
    });
  });

  it("normalizes invite emails before lookup and storage", () => {
    expect(normalizeInviteEmail("  OWNER@Example.COM ")).toBe("owner@example.com");
    expect(normalizeAuthEmail("  ADMIN@Example.COM ")).toBe("admin@example.com");
  });

  it("sends signed-in users to the right auth gate", () => {
    expect(getPostSignInPath({ companyId: null, emailVerified: new Date() })).toBe("/");
    expect(getPostSignInPath({ companyId: "company_123", emailVerified: null })).toBe("/verify-email");
    expect(getPostSignInPath({ companyId: "company_123", emailVerified: new Date() })).toBe("/dashboard");
  });

  it("requires a reasonably strong password", () => {
    expect(validatePassword("Password1").valid).toBe(true);

    expect(validatePassword("short1").errors).toContain("Password must be at least 8 characters.");
    expect(validatePassword("password").errors).toContain("Password must include a number.");
    expect(validatePassword("12345678").errors).toContain("Password must include a letter.");
  });
});
