import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
const signIn = vi.fn();
const userFindUnique = vi.fn();

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
  signIn,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: userFindUnique,
    },
  },
}));

function signInFormData(email: string, password = "Password1") {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("password", password);
  return formData;
}

async function submitSignIn(email = "owner@example.com") {
  const { signInWithPassword } = await import("./auth-actions");
  return signInWithPassword({}, signInFormData(email));
}

describe("signInWithPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the invalid-credentials message without redirecting", async () => {
    signIn.mockResolvedValue("/sign-in?error=CredentialsSignin&code=credentials");

    await expect(submitSignIn()).resolves.toEqual({
      message:
        "Invalid email or password. If you used magic links before, set your password first.",
    });

    expect(userFindUnique).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects a verified user with an active membership to the dashboard from fresh database state", async () => {
    signIn.mockResolvedValue("/verify-email");
    userFindUnique.mockResolvedValue({
      emailVerified: new Date("2026-06-23T10:00:00.000Z"),
      memberships: [{ companyId: "company_1" }],
    });

    await expect(submitSignIn(" OWNER@Example.COM ")).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );

    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "owner@example.com",
      password: "Password1",
      redirect: false,
      redirectTo: "/dashboard",
    });
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { email: "owner@example.com" },
      select: {
        emailVerified: true,
        memberships: {
          where: { status: "ACTIVE" },
          orderBy: { joinedAt: "asc" },
          select: { companyId: true },
        },
      },
    });
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects an unverified user with an active membership to verify email", async () => {
    signIn.mockResolvedValue("/dashboard");
    userFindUnique.mockResolvedValue({
      emailVerified: null,
      memberships: [{ companyId: "company_1" }],
    });

    await expect(submitSignIn()).rejects.toThrow("NEXT_REDIRECT:/verify-email");

    expect(redirect).toHaveBeenCalledWith("/verify-email");
  });
});
