import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminUser = vi.fn();
const accessErrorResponse = vi.fn();
const jobFindFirst = vi.fn();
const fileDeleteMany = vi.fn();
const noteDeleteMany = vi.fn();
const taskDeleteMany = vi.fn();
const exportDeleteMany = vi.fn();
const jobDelete = vi.fn();
const transaction = vi.fn();
const deleteR2Object = vi.fn();

vi.mock("@/lib/current-user", () => ({
  requireAdminUser,
  accessErrorResponse,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    job: {
      findFirst: jobFindFirst,
      delete: jobDelete,
    },
    file: {
      deleteMany: fileDeleteMany,
    },
    note: {
      deleteMany: noteDeleteMany,
    },
    task: {
      deleteMany: taskDeleteMany,
    },
    export: {
      deleteMany: exportDeleteMany,
    },
    $transaction: transaction,
  },
}));

vi.mock("@/lib/r2", () => ({
  deleteR2Object,
}));

async function deleteJob(id = "job-1") {
  const { DELETE } = await import("./route");
  return DELETE(new NextRequest(`http://localhost/api/jobs/${id}`, {
    method: "DELETE",
  }), {
    params: Promise.resolve({ id }),
  });
}

describe("DELETE /api/jobs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUser.mockResolvedValue({ id: "admin-1", companyId: "company-1", role: "ADMIN" });
    accessErrorResponse.mockReturnValue(null);
    jobFindFirst.mockResolvedValue({
      id: "job-1",
      files: [
        { id: "file-1", url: "company-1/file-1.pdf" },
        { id: "file-2", url: "company-1/file-2.jpg" },
      ],
      exports: [
        { id: "export-1", storageKey: "company-1/exports/job-1.zip" },
        { id: "export-2", storageKey: null },
      ],
    });
    fileDeleteMany.mockReturnValue({ kind: "fileDeleteMany" });
    noteDeleteMany.mockReturnValue({ kind: "noteDeleteMany" });
    taskDeleteMany.mockReturnValue({ kind: "taskDeleteMany" });
    exportDeleteMany.mockReturnValue({ kind: "exportDeleteMany" });
    jobDelete.mockReturnValue({ kind: "jobDelete" });
    transaction.mockResolvedValue([]);
    deleteR2Object.mockResolvedValue(undefined);
  });

  it("rejects members before deleting jobs", async () => {
    requireAdminUser.mockRejectedValueOnce(new Error("Admin access required"));
    accessErrorResponse.mockReturnValueOnce(
      NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    );

    const response = await deleteJob();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Admin access required" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("deletes a company-scoped job and child records for admins", async () => {
    const response = await deleteJob();

    expect(response.status).toBe(200);
    expect(jobFindFirst).toHaveBeenCalledWith({
      where: { id: "job-1", companyId: "company-1" },
      select: {
        id: true,
        files: { select: { id: true, url: true } },
        exports: { select: { id: true, storageKey: true } },
      },
    });
    expect(fileDeleteMany).toHaveBeenCalledWith({ where: { jobId: "job-1", companyId: "company-1" } });
    expect(noteDeleteMany).toHaveBeenCalledWith({ where: { jobId: "job-1", companyId: "company-1" } });
    expect(taskDeleteMany).toHaveBeenCalledWith({ where: { jobId: "job-1", companyId: "company-1" } });
    expect(exportDeleteMany).toHaveBeenCalledWith({ where: { jobId: "job-1" } });
    expect(jobDelete).toHaveBeenCalledWith({ where: { id: "job-1" } });
    expect(transaction).toHaveBeenCalledWith([
      { kind: "fileDeleteMany" },
      { kind: "noteDeleteMany" },
      { kind: "taskDeleteMany" },
      { kind: "exportDeleteMany" },
      { kind: "jobDelete" },
    ]);
    expect(deleteR2Object).toHaveBeenCalledWith("company-1/file-1.pdf");
    expect(deleteR2Object).toHaveBeenCalledWith("company-1/file-2.jpg");
    expect(deleteR2Object).toHaveBeenCalledWith("company-1/exports/job-1.zip");
    expect(deleteR2Object).toHaveBeenCalledTimes(3);
  });

  it("returns 404 for jobs outside the admin company", async () => {
    jobFindFirst.mockResolvedValueOnce(null);

    const response = await deleteJob("other-job");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Job not found" });
    expect(transaction).not.toHaveBeenCalled();
  });
});
