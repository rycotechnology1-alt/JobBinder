import { describe, expect, it } from "vitest";
import {
  canInviteMoreUsers,
  getPostSignInPath,
  normalizeInviteEmail,
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
  });

  it("sends signed-in users without a company to onboarding", () => {
    expect(getPostSignInPath({ companyId: null })).toBe("/onboarding");
    expect(getPostSignInPath({ companyId: "company_123" })).toBe("/");
  });
});
