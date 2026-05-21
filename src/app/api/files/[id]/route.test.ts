import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminUser = vi.fn();
const accessErrorResponse = vi.fn();
const fileFindFirst = vi.fn();
const fileDelete = vi.fn();
const deleteR2Object = vi.fn();

vi.mock("@/lib/current-user", () => ({
  requireAdminUser,
  accessErrorResponse,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    file: {
      findFirst: fileFindFirst,
      delete: fileDelete,
    },
  },
}));

vi.mock("@/lib/r2", () => ({
  deleteR2Object,
}));

async function deleteFile(id = "file-1") {
  const { DELETE } = await import("./route");
  return DELETE(new NextRequest(`http://localhost/api/files/${id}`, {
    method: "DELETE",
  }), {
    params: Promise.resolve({ id }),
  });
}

describe("DELETE /api/files/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUser.mockResolvedValue({ id: "admin-1", companyId: "company-1", role: "ADMIN" });
    accessErrorResponse.mockReturnValue(null);
    fileFindFirst.mockResolvedValue({ id: "file-1", url: "company-1/file-1.pdf" });
    fileDelete.mockResolvedValue({ id: "file-1" });
    deleteR2Object.mockResolvedValue(undefined);
  });

  it("rejects members before deleting files", async () => {
    requireAdminUser.mockRejectedValueOnce(new Error("Admin access required"));
    accessErrorResponse.mockReturnValueOnce(
      NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    );

    const response = await deleteFile();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Admin access required" });
    expect(fileDelete).not.toHaveBeenCalled();
    expect(deleteR2Object).not.toHaveBeenCalled();
  });

  it("deletes company-scoped files for admins and attempts storage cleanup", async () => {
    const response = await deleteFile();

    expect(response.status).toBe(200);
    expect(fileFindFirst).toHaveBeenCalledWith({
      where: { id: "file-1", companyId: "company-1", jobId: { not: null } },
      select: { id: true, url: true },
    });
    expect(fileDelete).toHaveBeenCalledWith({ where: { id: "file-1" } });
    expect(deleteR2Object).toHaveBeenCalledWith("company-1/file-1.pdf");
  });

  it("keeps the database deletion successful when storage cleanup fails", async () => {
    deleteR2Object.mockRejectedValueOnce(new Error("R2 unavailable"));

    const response = await deleteFile();

    expect(response.status).toBe(200);
    expect(fileDelete).toHaveBeenCalledWith({ where: { id: "file-1" } });
  });

  it("returns 404 for files outside the admin company", async () => {
    fileFindFirst.mockResolvedValueOnce(null);

    const response = await deleteFile("other-file");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "File not found" });
    expect(fileDelete).not.toHaveBeenCalled();
  });
});
