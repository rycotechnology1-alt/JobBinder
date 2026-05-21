import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminUser = vi.fn();
const accessErrorResponse = vi.fn();
const noteFindFirst = vi.fn();
const noteDelete = vi.fn();

vi.mock("@/lib/current-user", () => ({
  requireAdminUser,
  accessErrorResponse,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    note: {
      findFirst: noteFindFirst,
      delete: noteDelete,
    },
  },
}));

async function deleteNote(id = "note-1") {
  const { DELETE } = await import("./route");
  return DELETE(new NextRequest(`http://localhost/api/notes/${id}`, {
    method: "DELETE",
  }), {
    params: Promise.resolve({ id }),
  });
}

describe("DELETE /api/notes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUser.mockResolvedValue({ id: "admin-1", companyId: "company-1", role: "ADMIN" });
    accessErrorResponse.mockReturnValue(null);
    noteFindFirst.mockResolvedValue({ id: "note-1" });
    noteDelete.mockResolvedValue({ id: "note-1" });
  });

  it("rejects members before deleting notes", async () => {
    requireAdminUser.mockRejectedValueOnce(new Error("Admin access required"));
    accessErrorResponse.mockReturnValueOnce(
      NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    );

    const response = await deleteNote();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Admin access required" });
    expect(noteDelete).not.toHaveBeenCalled();
  });

  it("deletes company-scoped notes for admins", async () => {
    const response = await deleteNote();

    expect(response.status).toBe(200);
    expect(noteFindFirst).toHaveBeenCalledWith({
      where: { id: "note-1", companyId: "company-1", jobId: { not: null } },
      select: { id: true },
    });
    expect(noteDelete).toHaveBeenCalledWith({ where: { id: "note-1" } });
  });

  it("returns 404 for notes outside the admin company", async () => {
    noteFindFirst.mockResolvedValueOnce(null);

    const response = await deleteNote("other-note");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Note not found" });
    expect(noteDelete).not.toHaveBeenCalled();
  });
});
