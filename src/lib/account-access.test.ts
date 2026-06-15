import { describe, expect, it } from "vitest";
import {
  buildAccessibleJobWhere,
  canManageMembership,
  isAccountManagerRole,
  type AccountRole,
} from "./account-access";

describe("account access policy", () => {
  it("treats owners and admins as account managers", () => {
    expect(isAccountManagerRole("OWNER")).toBe(true);
    expect(isAccountManagerRole("ADMIN")).toBe(true);
    expect(isAccountManagerRole("MEMBER")).toBe(false);
  });

  it("lets admins promote members but not manage admins", () => {
    expect(canManageMembership({ actorRole: "ADMIN", targetRole: "MEMBER", nextRole: "ADMIN" })).toBe(true);
    expect(canManageMembership({ actorRole: "ADMIN", targetRole: "ADMIN", nextRole: "MEMBER" })).toBe(false);
    expect(canManageMembership({ actorRole: "ADMIN", targetRole: "ADMIN", nextStatus: "DEACTIVATED" })).toBe(false);
    expect(canManageMembership({ actorRole: "ADMIN", targetRole: "ADMIN", nextStatus: "REMOVED" })).toBe(false);
  });

  it("lets owners demote, deactivate, and remove admins without creating new owners", () => {
    expect(canManageMembership({ actorRole: "OWNER", targetRole: "ADMIN", nextRole: "MEMBER" })).toBe(true);
    expect(canManageMembership({ actorRole: "OWNER", targetRole: "ADMIN", nextStatus: "DEACTIVATED" })).toBe(true);
    expect(canManageMembership({ actorRole: "OWNER", targetRole: "ADMIN", nextStatus: "REMOVED" })).toBe(true);
    expect(canManageMembership({ actorRole: "OWNER", targetRole: "MEMBER", nextRole: "OWNER" as AccountRole })).toBe(false);
  });

  it("builds broad company job access for owners and admins", () => {
    expect(buildAccessibleJobWhere({
      companyId: "company-1",
      membershipId: "membership-1",
      role: "OWNER",
      crewIds: [],
      orgUnitIds: [],
    })).toEqual({ companyId: "company-1" });

    expect(buildAccessibleJobWhere({
      companyId: "company-1",
      membershipId: "membership-1",
      role: "ADMIN",
      crewIds: ["crew-1"],
      orgUnitIds: ["org-1"],
    })).toEqual({ companyId: "company-1" });
  });

  it("builds assigned-only job access for members", () => {
    expect(buildAccessibleJobWhere({
      companyId: "company-1",
      membershipId: "membership-1",
      role: "MEMBER",
      crewIds: ["crew-1"],
      orgUnitIds: ["org-1"],
    })).toEqual({
      companyId: "company-1",
      OR: [
        { accessGrants: { some: { principalType: "MEMBER", principalId: "membership-1" } } },
        { workspace: { accessGrants: { some: { principalType: "MEMBER", principalId: "membership-1" } } } },
        { accessGrants: { some: { principalType: "CREW", principalId: { in: ["crew-1"] } } } },
        { workspace: { accessGrants: { some: { principalType: "CREW", principalId: { in: ["crew-1"] } } } } },
        { accessGrants: { some: { principalType: "ORG_UNIT", principalId: { in: ["org-1"] } } } },
        { workspace: { accessGrants: { some: { principalType: "ORG_UNIT", principalId: { in: ["org-1"] } } } } },
      ],
    });
  });
});
