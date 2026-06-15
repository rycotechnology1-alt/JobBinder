import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCompanyUser = vi.fn();
const accessErrorResponse = vi.fn();
const jobFindFirst = vi.fn();
const fileFindFirst = vi.fn();
const fileUpdate = vi.fn();
const fileCreate = vi.fn();
const noteFindFirst = vi.fn();
const taskFindFirst = vi.fn();
const markupMarkFindFirst = vi.fn();
const markupExportUpsert = vi.fn();

vi.mock("@/lib/current-user", () => ({
  requireCompanyUser,
  accessErrorResponse,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    job: {
      findFirst: jobFindFirst,
    },
    file: {
      create: fileCreate,
      findFirst: fileFindFirst,
      update: fileUpdate,
    },
    note: {
      findFirst: noteFindFirst,
    },
    task: {
      findFirst: taskFindFirst,
    },
    fileMarkupMark: {
      findFirst: markupMarkFindFirst,
    },
    fileMarkupExport: {
      upsert: markupExportUpsert,
    },
  },
}));

vi.mock("@/lib/r2", () => ({
  isCompanyScopedObjectKey: vi.fn(() => true),
}));

async function patchFile(body: unknown) {
  const { PATCH } = await import("./route");
  return PATCH(new NextRequest("http://localhost/api/files", {
    method: "PATCH",
    body: JSON.stringify(body),
  }));
}

async function postFile(body: unknown) {
  const { POST } = await import("./route");
  return POST(new NextRequest("http://localhost/api/files", {
    method: "POST",
    body: JSON.stringify(body),
  }));
}

describe("PATCH /api/files", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireCompanyUser.mockResolvedValue({
      id: "user-1",
      companyId: "company-1",
      membershipId: "membership-1",
      role: "ADMIN",
      crewIds: [],
      orgUnitIds: [],
    });
    accessErrorResponse.mockReturnValue(null);
    jobFindFirst.mockResolvedValue({ id: "job-1" });
    fileFindFirst.mockResolvedValue({ id: "file-1" });
    fileUpdate.mockResolvedValue({ id: "file-1", jobId: "job-1" });
    fileCreate.mockResolvedValue({ id: "file-created" });
  });

  it("assigns a company-scoped inbox file to a company-owned job", async () => {
    const response = await patchFile({ id: "file-1", jobId: "job-1" });

    expect(response.status).toBe(200);
    expect(jobFindFirst).toHaveBeenCalledWith({
      where: { id: "job-1", companyId: "company-1" },
      select: { id: true },
    });
    expect(fileFindFirst).toHaveBeenCalledWith({
      where: { id: "file-1", companyId: "company-1" },
      select: { id: true },
    });
    expect(fileUpdate).toHaveBeenCalledWith({
      where: { id: "file-1" },
      data: { jobId: "job-1" },
    });
  });

  it("rejects missing ids, unknown jobs, and unknown files", async () => {
    const missingIds = await patchFile({ id: "file-1" });
    expect(missingIds.status).toBe(400);
    expect(await missingIds.json()).toEqual({ error: "Missing file id or job id" });

    jobFindFirst.mockResolvedValueOnce(null);
    const missingJob = await patchFile({ id: "file-1", jobId: "other-job" });
    expect(missingJob.status).toBe(404);
    expect(await missingJob.json()).toEqual({ error: "Job not found" });

    fileFindFirst.mockResolvedValueOnce(null);
    const missingFile = await patchFile({ id: "other-file", jobId: "job-1" });
    expect(missingFile.status).toBe(404);
    expect(await missingFile.json()).toEqual({ error: "File not found" });
    expect(fileUpdate).not.toHaveBeenCalled();
  });
});

describe("POST /api/files", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireCompanyUser.mockResolvedValue({
      id: "user-1",
      companyId: "company-1",
      membershipId: "membership-1",
      role: "ADMIN",
      crewIds: [],
      orgUnitIds: [],
    });
    accessErrorResponse.mockReturnValue(null);
    jobFindFirst.mockResolvedValue({ id: "job-1" });
    fileFindFirst.mockResolvedValue(null);
    fileCreate.mockResolvedValue({ id: "file-created", clientMutationId: "offline-1" });
    noteFindFirst.mockResolvedValue({ id: "report-1", jobId: "job-1" });
    taskFindFirst.mockResolvedValue({ id: "task-1", jobId: "job-1" });
    markupMarkFindFirst.mockResolvedValue({
      id: "mark-1",
      kind: "PIN",
      file: { id: "source-file", jobId: "job-1" },
    });
    markupExportUpsert.mockResolvedValue({ id: "markup-export" });
  });

  it("returns an existing file for a repeated offline clientMutationId", async () => {
    fileFindFirst.mockResolvedValueOnce({ id: "file-existing", clientMutationId: "offline-1" });

    const response = await postFile({
      jobId: "job-1",
      objectKey: "company-1/file.jpg",
      originalName: "before.jpg",
      name: "Before",
      contentType: "image/jpeg",
      category: "Before",
      createdAt: "2026-05-14T12:00:00.000Z",
      clientMutationId: "offline-1",
    });

    expect(response.status).toBe(200);
    expect(fileFindFirst).toHaveBeenCalledWith({
      where: { companyId: "company-1", clientMutationId: "offline-1" },
    });
    expect(fileCreate).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ id: "file-existing", clientMutationId: "offline-1" });
  });

  it("stores clientMutationId and original capture time for new offline files", async () => {
    const response = await postFile({
      jobId: "job-1",
      objectKey: "company-1/file.jpg",
      originalName: "before.jpg",
      name: "Before",
      contentType: "image/jpeg",
      category: "Before",
      createdAt: "2026-05-14T12:00:00.000Z",
      clientMutationId: "offline-2",
    });

    expect(response.status).toBe(201);
    expect(fileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
        jobId: "job-1",
        uploaderId: "user-1",
        originalName: "before.jpg",
        contentType: "image/jpeg",
        createdAt: new Date("2026-05-14T12:00:00.000Z"),
        clientMutationId: "offline-2",
      }),
    });
  });

  it("stores content type and optional size metadata for new files", async () => {
    const response = await postFile({
      jobId: "job-1",
      objectKey: "company-1/deck.pptx",
      originalName: "deck.pptx",
      contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      sizeBytes: 456789,
      category: "Plans",
    });

    expect(response.status).toBe(201);
    expect(fileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "DOCUMENT",
        contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        sizeBytes: 456789,
      }),
    });
  });

  it("links uploads to a company-scoped daily report note", async () => {
    const response = await postFile({
      jobId: "job-1",
      noteId: "report-1",
      objectKey: "company-1/photo.jpg",
      originalName: "photo.jpg",
      contentType: "image/jpeg",
      category: "Misc",
    });

    expect(response.status).toBe(201);
    expect(noteFindFirst).toHaveBeenCalledWith({
      where: { id: "report-1", companyId: "company-1", jobId: "job-1" },
      select: { id: true, jobId: true },
    });
    expect(fileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jobId: "job-1",
        noteId: "report-1",
      }),
    });
  });

  it("links uploads to a task and pinned markup comment on the same job", async () => {
    const response = await postFile({
      jobId: "job-1",
      taskId: "task-1",
      markupMarkId: "mark-1",
      objectKey: "company-1/pin-photo.jpg",
      originalName: "pin-photo.jpg",
      contentType: "image/jpeg",
      category: "Issue",
    });

    expect(response.status).toBe(201);
    expect(taskFindFirst).toHaveBeenCalledWith({
      where: { id: "task-1", companyId: "company-1", jobId: "job-1" },
      select: { id: true, jobId: true },
    });
    expect(markupMarkFindFirst).toHaveBeenCalledWith({
      where: { id: "mark-1", companyId: "company-1", deletedAt: null },
      select: { id: true, kind: true, file: { select: { id: true, jobId: true } } },
    });
    expect(fileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jobId: "job-1",
        taskId: "task-1",
        markupMarkId: "mark-1",
      }),
    });
    expect(markupExportUpsert).toHaveBeenCalledWith({
      where: { fileId: "source-file" },
      create: { fileId: "source-file", isStale: true },
      update: { isStale: true },
    });
  });

  it("rejects task and pin links that are not on the target job", async () => {
    taskFindFirst.mockResolvedValueOnce(null);
    const missingTask = await postFile({
      jobId: "job-1",
      taskId: "other-task",
      objectKey: "company-1/photo.jpg",
      originalName: "photo.jpg",
      contentType: "image/jpeg",
      category: "Misc",
    });

    expect(missingTask.status).toBe(404);
    expect(await missingTask.json()).toEqual({ error: "Task not found" });

    markupMarkFindFirst.mockResolvedValueOnce({
      id: "mark-2",
      kind: "PIN",
      file: { id: "source-file-2", jobId: "other-job" },
    });
    const mismatchedPin = await postFile({
      jobId: "job-1",
      markupMarkId: "mark-2",
      objectKey: "company-1/photo.jpg",
      originalName: "photo.jpg",
      contentType: "image/jpeg",
      category: "Misc",
    });

    expect(mismatchedPin.status).toBe(400);
    expect(await mismatchedPin.json()).toEqual({ error: "Pinned comment is not on this job" });
    expect(fileCreate).not.toHaveBeenCalled();
  });

  it("allows only photo uploads as pinned comment attachments", async () => {
    const response = await postFile({
      jobId: "job-1",
      markupMarkId: "mark-1",
      objectKey: "company-1/spec.pdf",
      originalName: "spec.pdf",
      contentType: "application/pdf",
      category: "Plans",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Pinned comment attachments must be images." });
    expect(fileCreate).not.toHaveBeenCalled();
  });

  it("rejects a noteId that is not on the same company job", async () => {
    noteFindFirst.mockResolvedValueOnce(null);

    const response = await postFile({
      jobId: "job-1",
      noteId: "other-report",
      objectKey: "company-1/photo.jpg",
      originalName: "photo.jpg",
      contentType: "image/jpeg",
      category: "Misc",
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Daily report not found" });
    expect(fileCreate).not.toHaveBeenCalled();
  });

  it("rejects legacy DOC file records with a conversion message", async () => {
    const response = await postFile({
      jobId: "job-1",
      objectKey: "company-1/legacy.doc",
      originalName: "legacy.doc",
      contentType: "application/msword",
      category: "Customer Documents",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Legacy .doc files are not supported. Convert the document to .docx before uploading.",
    });
    expect(fileCreate).not.toHaveBeenCalled();
  });
});
