import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function loadServiceWorker(location: string) {
  const source = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
  const listeners = new Map<string, EventListener>();
  const sandbox = {
    caches: {
      delete: vi.fn(),
      keys: vi.fn(),
      match: vi.fn(),
      open: vi.fn(),
    },
    fetch: vi.fn(),
    Promise,
    Response,
    self: {
      clients: { claim: vi.fn() },
      location: new URL(location),
      skipWaiting: vi.fn(),
      addEventListener: vi.fn((event: string, listener: EventListener) => {
        listeners.set(event, listener);
      }),
    },
    URL,
  };

  runInNewContext(`${source}; self.__test = { shouldBypass };`, sandbox);

  return (sandbox.self as typeof sandbox.self & {
    __test: {
      shouldBypass: (request: Request, url: URL) => boolean;
    };
  }).__test;
}

describe("service worker", () => {
  it("bypasses Next.js static chunks during local development", () => {
    const { shouldBypass } = loadServiceWorker("http://localhost:3000/sw.js");
    const request = new Request("http://localhost:3000/_next/static/chunks/app/jobs/page.js");
    const url = new URL(request.url);

    expect(shouldBypass(request, url)).toBe(true);
  });
});
