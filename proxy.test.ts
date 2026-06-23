import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn((handler) => handler);

vi.mock("@/auth", () => ({
  auth,
}));

function proxyRequest(
  path: string,
  authValue: { user?: Record<string, unknown> } | null = null,
) {
  return {
    auth: authValue,
    nextUrl: new URL(`http://localhost${path}`),
  };
}

async function runProxy(
  path: string,
  authValue: { user?: Record<string, unknown> } | null = null,
) {
  const { proxy } = await import("./proxy");
  return proxy(proxyRequest(path, authValue) as never);
}

describe("proxy auth routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects signed-out users away from protected routes", async () => {
    const response = await runProxy("/dashboard");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/sign-in");
  });

  it("lets signed-in dashboard requests reach page guards even when session verification is stale", async () => {
    const response = await runProxy("/dashboard", {
      user: {
        emailVerified: null,
        hasActiveMembership: true,
      },
    });

    expect(response.headers.get("location")).toBeNull();
  });

  it("leaves public auth pages for page-level redirects", async () => {
    const response = await runProxy("/verify-email", {
      user: {
        emailVerified: new Date("2026-06-23T10:00:00.000Z"),
        hasActiveMembership: true,
      },
    });

    expect(response.headers.get("location")).toBeNull();
  });
});
