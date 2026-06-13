import { describe, expect, it } from "vitest";
import { parseMarkMutations, serializeMark } from "./serialize";

const validMark = {
  id: "mark-1",
  page: 1,
  kind: "ELLIPSE",
  geometry: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
  style: { color: "#ef4444", strokeWidth: 0.004, opacity: 1 },
  sequence: 0,
  clientUpdatedAt: "2026-06-13T12:00:00.000Z",
};

describe("parseMarkMutations", () => {
  it("accepts a valid upsert and strips server-owned fields", () => {
    const result = parseMarkMutations({
      mutations: [{ op: "upsert", mark: { ...validMark, fileId: "spoofed", authorId: "spoofed" } }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const mutation = result.mutations[0];
    expect(mutation.op).toBe("upsert");
    if (mutation.op !== "upsert") return;
    expect(mutation.mark.fileId).toBe(""); // never trusted from the client
    expect(mutation.mark.kind).toBe("ELLIPSE");
  });

  it("accepts a valid delete", () => {
    const result = parseMarkMutations({
      mutations: [{ op: "delete", id: "mark-1", clientUpdatedAt: "2026-06-13T12:00:00.000Z" }],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a non-array body", () => {
    expect(parseMarkMutations({ mutations: "nope" }).ok).toBe(false);
    expect(parseMarkMutations(null).ok).toBe(false);
    expect(parseMarkMutations({ mutations: [] }).ok).toBe(false);
  });

  it("rejects an unknown op", () => {
    expect(parseMarkMutations({ mutations: [{ op: "patch", mark: validMark }] }).ok).toBe(false);
  });

  it("rejects an invalid kind", () => {
    const result = parseMarkMutations({ mutations: [{ op: "upsert", mark: { ...validMark, kind: "SQUIGGLE" } }] });
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed style", () => {
    const result = parseMarkMutations({
      mutations: [{ op: "upsert", mark: { ...validMark, style: { color: "#fff" } } }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a missing clientUpdatedAt", () => {
    const { clientUpdatedAt, ...withoutDate } = validMark;
    void clientUpdatedAt;
    const result = parseMarkMutations({ mutations: [{ op: "upsert", mark: withoutDate }] });
    expect(result.ok).toBe(false);
  });
});

describe("serializeMark", () => {
  it("converts a db row into ISO-stringed client mark", () => {
    const mark = serializeMark({
      id: "mark-1",
      fileId: "file-1",
      page: 2,
      kind: "PIN",
      geometry: { x: 0.5, y: 0.5 },
      style: { color: "#22c55e", strokeWidth: 0.004, opacity: 1 },
      text: "Check this",
      sequence: 3,
      authorId: "user-1",
      deletedAt: null,
      clientUpdatedAt: new Date("2026-06-13T12:00:00.000Z"),
    });
    expect(mark).toMatchObject({
      id: "mark-1",
      fileId: "file-1",
      page: 2,
      kind: "PIN",
      sequence: 3,
      deletedAt: null,
      clientUpdatedAt: "2026-06-13T12:00:00.000Z",
    });
  });
});
