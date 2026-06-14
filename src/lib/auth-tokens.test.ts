import { describe, expect, it, vi } from "vitest";
import {
  consumeOneTimeToken,
  createOneTimeToken,
  getTokenIdentifier,
  hashOneTimeToken,
} from "./auth-tokens";

function createTokenStore() {
  const records: Array<{ identifier: string; token: string; expires: Date }> = [];

  return {
    records,
    client: {
      verificationToken: {
        deleteMany: vi.fn(async ({ where }) => {
          const before = records.length;
          for (let index = records.length - 1; index >= 0; index -= 1) {
            const record = records[index];
            if (record.identifier === where.identifier) {
              records.splice(index, 1);
            }
          }
          return { count: before - records.length };
        }),
        create: vi.fn(async ({ data }) => {
          records.push(data);
          return data;
        }),
        findUnique: vi.fn(async ({ where }) => {
          return records.find(
            (record) =>
              record.identifier === where.identifier_token.identifier &&
              record.token === where.identifier_token.token,
          ) ?? null;
        }),
        delete: vi.fn(async ({ where }) => {
          const index = records.findIndex(
            (record) =>
              record.identifier === where.identifier_token.identifier &&
              record.token === where.identifier_token.token,
          );
          if (index >= 0) {
            const [record] = records.splice(index, 1);
            return record;
          }
          throw new Error("Token not found");
        }),
      },
    },
  };
}

describe("auth one-time tokens", () => {
  it("namespaces identifiers by token purpose", () => {
    expect(getTokenIdentifier("email-verify", "OWNER@Example.COM")).toBe(
      "email-verify:owner@example.com",
    );
    expect(getTokenIdentifier("invite", "invite_123")).toBe("invite:invite_123");
  });

  it("stores only hashed one-time tokens with an expiry", async () => {
    const store = createTokenStore();
    const now = new Date("2026-06-14T10:00:00.000Z");

    const token = await createOneTimeToken({
      prisma: store.client,
      purpose: "email-verify",
      key: "owner@example.com",
      maxAgeMs: 60_000,
      now,
    });

    expect(token).toHaveLength(43);
    expect(store.records).toEqual([
      {
        identifier: "email-verify:owner@example.com",
        token: hashOneTimeToken(token),
        expires: new Date("2026-06-14T10:01:00.000Z"),
      },
    ]);
  });

  it("consumes a valid token exactly once", async () => {
    const store = createTokenStore();
    const now = new Date("2026-06-14T10:00:00.000Z");
    const token = await createOneTimeToken({
      prisma: store.client,
      purpose: "password-reset",
      key: "owner@example.com",
      maxAgeMs: 60_000,
      now,
    });

    await expect(
      consumeOneTimeToken({
        prisma: store.client,
        purpose: "password-reset",
        key: "owner@example.com",
        token,
        now,
      }),
    ).resolves.toBe(true);

    await expect(
      consumeOneTimeToken({
        prisma: store.client,
        purpose: "password-reset",
        key: "owner@example.com",
        token,
        now,
      }),
    ).resolves.toBe(false);
  });

  it("rejects expired tokens", async () => {
    const store = createTokenStore();
    const token = await createOneTimeToken({
      prisma: store.client,
      purpose: "invite",
      key: "invite_123",
      maxAgeMs: 60_000,
      now: new Date("2026-06-14T10:00:00.000Z"),
    });

    await expect(
      consumeOneTimeToken({
        prisma: store.client,
        purpose: "invite",
        key: "invite_123",
        token,
        now: new Date("2026-06-14T10:02:00.000Z"),
      }),
    ).resolves.toBe(false);
  });
});
