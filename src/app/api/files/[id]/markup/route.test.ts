import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireFileAccess = vi.fn();
const accessErrorResponse = vi.fn();
const fileFindFirst = vi.fn();
const markFindMany = vi.fn();
const markCreate = vi.fn();
const markUpdate = vi.fn();
const exportUpsert = vi.fn();
const transaction = vi.fn();

vi.mock("@/lib/current-user", () => ({ requireFileAccess, accessErrorResponse }));
vi.mock("@/lib/prisma", () => ({
  default: {
    file: { findFirst: fileFindFirst },
    fileMarkupMark: { findMany: markFindMany, create: markCreate, update: markUpdate },
    fileMarkupExport: { upsert: exportUpsert },
    $transaction: transaction,
  },
}));

function makeMark(overrides: Record<string, unknown> = {}) {
  return {
    id: "mark-1",
    page: 1,
    kind: "ELLIPSE",
    geometry: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
    style: { color: "#ef4444", strokeWidth: 0.004, opacity: 1 },
    sequence: 0,
    clientUpdatedAt: "2026-06-13T12:00:00.000Z",
    ...overrides,
  };
}

async function getMarkup(id = "file-1") {
  const { GET } = await import("./route");
  return GET(new NextRequest(`http://localhost/api/files/${id}/markup`), {
    params: Promise.resolve({ id }),
  });
}

async function postMarkup(body: unknown, id = "file-1") {
  const { POST } = await import("./route");
  const req = new NextRequest(`http://localhost/api/files/${id}/markup`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  return POST(req, { params: Promise.resolve({ id }) });
}

describe("/api/files/[id]/markup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireFileAccess.mockResolvedValue({
      user: { id: "user-1", companyId: "company-1" },
      file: { id: "file-1" },
    });
    accessErrorResponse.mockReturnValue(null);
    fileFindFirst.mockResolvedValue({ id: "file-1" });
    markFindMany.mockResolvedValue([]);
    transaction.mockResolvedValue([]);
  });

  it("GET returns serialized marks for the file", async () => {
    markFindMany.mockResolvedValueOnce([
      {
        id: "mark-1",
        fileId: "file-1",
        page: 1,
        kind: "PIN",
        geometry: { x: 0.5, y: 0.5 },
        style: { color: "#22c55e", strokeWidth: 0.004, opacity: 1 },
        text: "Look here",
        sequence: 0,
        authorId: "user-1",
        deletedAt: null,
        clientUpdatedAt: new Date("2026-06-13T12:00:00.000Z"),
      },
    ]);

    const response = await getMarkup();
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.marks).toHaveLength(1);
    expect(json.marks[0]).toMatchObject({ id: "mark-1", kind: "PIN", text: "Look here" });
  });

  it("GET 404s when the file is not in the company", async () => {
    fileFindFirst.mockResolvedValueOnce(null);
    expect((await getMarkup()).status).toBe(404);
  });

  it("POST creates a new mark with server-owned scoping fields", async () => {
    markFindMany.mockResolvedValueOnce([]); // no existing marks
    const response = await postMarkup({ mutations: [{ op: "upsert", mark: makeMark() }] });

    expect(response.status).toBe(200);
    expect(markCreate).toHaveBeenCalledTimes(1);
    expect(markCreate.mock.calls[0][0].data).toMatchObject({
      id: "mark-1",
      fileId: "file-1",
      companyId: "company-1",
      authorId: "user-1",
      kind: "ELLIPSE",
    });
    expect(markUpdate).not.toHaveBeenCalled();
    expect(exportUpsert).toHaveBeenCalledTimes(1);
    expect(await response.json()).toMatchObject({ ok: true, applied: 1 });
  });

  it("POST skips a stale upsert (per-mark last-write-wins)", async () => {
    markFindMany.mockResolvedValueOnce([
      { id: "mark-1", clientUpdatedAt: new Date("2026-06-13T13:00:00.000Z") },
    ]);
    const response = await postMarkup({
      mutations: [{ op: "upsert", mark: makeMark({ clientUpdatedAt: "2026-06-13T12:00:00.000Z" }) }],
    });

    expect(markCreate).not.toHaveBeenCalled();
    expect(markUpdate).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ ok: true, applied: 0 });
  });

  it("POST updates a mark when the incoming edit is newer", async () => {
    markFindMany.mockResolvedValueOnce([
      { id: "mark-1", clientUpdatedAt: new Date("2026-06-13T11:00:00.000Z") },
    ]);
    await postMarkup({
      mutations: [{ op: "upsert", mark: makeMark({ clientUpdatedAt: "2026-06-13T12:00:00.000Z" }) }],
    });

    expect(markUpdate).toHaveBeenCalledTimes(1);
    expect(markCreate).not.toHaveBeenCalled();
  });

  it("POST soft-deletes an existing mark", async () => {
    markFindMany.mockResolvedValueOnce([
      { id: "mark-1", clientUpdatedAt: new Date("2026-06-13T11:00:00.000Z") },
    ]);
    await postMarkup({
      mutations: [{ op: "delete", id: "mark-1", clientUpdatedAt: "2026-06-13T12:00:00.000Z" }],
    });

    expect(markUpdate).toHaveBeenCalledTimes(1);
    expect(markUpdate.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
  });

  it("POST 400s on an invalid body", async () => {
    expect((await postMarkup({ mutations: [] })).status).toBe(400);
  });

  it("POST 404s when the file is not in the company", async () => {
    fileFindFirst.mockResolvedValueOnce(null);
    expect((await postMarkup({ mutations: [{ op: "upsert", mark: makeMark() }] })).status).toBe(404);
  });
});
