import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCompanyUser = vi.fn();
const accessErrorResponse = vi.fn();
const jobFindFirst = vi.fn();
const fileFindFirst = vi.fn();
const fileUpdate = vi.fn();
const fileCreate = vi.fn();

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
    vi.clearAllMocks();
    requireCompanyUser.mockResolvedValue({ id: "user-1", companyId: "company-1" });
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
    vi.clearAllMocks();
    requireCompanyUser.mockResolvedValue({ id: "user-1", companyId: "company-1" });
    accessErrorResponse.mockReturnValue(null);
    jobFindFirst.mockResolvedValue({ id: "job-1" });
    fileFindFirst.mockResolvedValue(null);
    fileCreate.mockResolvedValue({ id: "file-created", clientMutationId: "offline-1" });
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
});
