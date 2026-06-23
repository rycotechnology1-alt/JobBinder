import { afterEach, describe, expect, it, vi } from "vitest";
import { buildUrl } from "./auth-email";

const OFFICIAL_ORIGIN = "https://jobbinderapp.com";

function clearEmailUrlEnv() {
  vi.stubEnv("AUTH_URL", "");
  vi.stubEnv("NEXTAUTH_URL", "");
  vi.stubEnv("VERCEL_URL", "");
}

function buildVerificationUrl() {
  return new URL(
    buildUrl("/verify-email/confirm", {
      email: "owner@example.com",
      token: "token_123",
    }),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("auth email URL builder", () => {
  it("builds production email links from the official AUTH_URL", () => {
    clearEmailUrlEnv();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_URL", OFFICIAL_ORIGIN);
    vi.stubEnv("NEXTAUTH_URL", "https://fallback.example.com");
    vi.stubEnv("VERCEL_URL", "job-binder.vercel.app");

    const url = buildVerificationUrl();

    expect(url.origin).toBe(OFFICIAL_ORIGIN);
    expect(url.pathname).toBe("/verify-email/confirm");
    expect(url.searchParams.get("email")).toBe("owner@example.com");
    expect(url.searchParams.get("token")).toBe("token_123");
  });

  it("uses the official NEXTAUTH_URL when AUTH_URL is absent", () => {
    clearEmailUrlEnv();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXTAUTH_URL", OFFICIAL_ORIGIN);

    expect(buildVerificationUrl().origin).toBe(OFFICIAL_ORIGIN);
  });

  it("fails closed when production email URL config is missing", () => {
    clearEmailUrlEnv();
    vi.stubEnv("NODE_ENV", "production");

    expect(() => buildVerificationUrl()).toThrow(
      "Set AUTH_URL=https://jobbinderapp.com in production before sending auth emails.",
    );
  });

  it("ignores VERCEL_URL as a production email link fallback", () => {
    clearEmailUrlEnv();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_URL", "job-binder.vercel.app");

    expect(() => buildVerificationUrl()).toThrow(
      "Set AUTH_URL=https://jobbinderapp.com in production before sending auth emails.",
    );
  });

  it("rejects vercel.app as the production AUTH_URL", () => {
    clearEmailUrlEnv();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_URL", "https://job-binder.vercel.app");

    expect(() => buildVerificationUrl()).toThrow(
      "Auth email links must use https://jobbinderapp.com in production.",
    );
  });

  it("keeps the localhost fallback outside production", () => {
    clearEmailUrlEnv();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_URL", "job-binder.vercel.app");

    expect(buildVerificationUrl().origin).toBe("http://localhost:3000");
  });
});
