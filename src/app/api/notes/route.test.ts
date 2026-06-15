import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCompanyUser = vi.fn();
const accessErrorResponse = vi.fn();
const jobFindFirst = vi.fn();
const noteFindFirst = vi.fn();
const noteUpdate = vi.fn();
const noteCreate = vi.fn();

vi.mock("@/lib/current-user", () => ({
  requireCompanyUser,
  accessErrorResponse,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    job: {
      findFirst: jobFindFirst,
    },
    note: {
      create: noteCreate,
      findFirst: noteFindFirst,
      update: noteUpdate,
    },
  },
}));

async function patchNote(body: unknown) {
  const { PATCH } = await import("./route");
  return PATCH(new NextRequest("http://localhost/api/notes", {
    method: "PATCH",
    body: JSON.stringify(body),
  }));
}

async function postNote(body: unknown) {
  const { POST } = await import("./route");
  return POST(new NextRequest("http://localhost/api/notes", {
    method: "POST",
    body: JSON.stringify(body),
  }));
}

describe("PATCH /api/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    noteFindFirst.mockResolvedValue({ id: "note-1" });
    noteUpdate.mockResolvedValue({ id: "note-1", jobId: "job-1" });
    noteCreate.mockResolvedValue({ id: "note-created" });
  });

  it("assigns a company-scoped inbox note to a company-owned job", async () => {
    const response = await patchNote({ id: "note-1", jobId: "job-1" });

    expect(response.status).toBe(200);
    expect(jobFindFirst).toHaveBeenCalledWith({
      where: { id: "job-1", companyId: "company-1" },
      select: { id: true },
    });
    expect(noteFindFirst).toHaveBeenCalledWith({
      where: { id: "note-1", companyId: "company-1" },
      select: { id: true },
    });
    expect(noteUpdate).toHaveBeenCalledWith({
      where: { id: "note-1" },
      data: { jobId: "job-1" },
    });
  });

  it("rejects missing ids, unknown jobs, and unknown notes", async () => {
    const missingIds = await patchNote({ id: "note-1" });
    expect(missingIds.status).toBe(400);
    expect(await missingIds.json()).toEqual({ error: "Missing note id or job id" });

    jobFindFirst.mockResolvedValueOnce(null);
    const missingJob = await patchNote({ id: "note-1", jobId: "other-job" });
    expect(missingJob.status).toBe(404);
    expect(await missingJob.json()).toEqual({ error: "Job not found" });

    noteFindFirst.mockResolvedValueOnce(null);
    const missingNote = await patchNote({ id: "other-note", jobId: "job-1" });
    expect(missingNote.status).toBe(404);
    expect(await missingNote.json()).toEqual({ error: "Note not found" });
    expect(noteUpdate).not.toHaveBeenCalled();
  });
});

describe("POST /api/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    noteFindFirst.mockResolvedValue(null);
    noteCreate.mockResolvedValue({ id: "note-created", clientMutationId: "offline-1" });
  });

  it("returns an existing note for a repeated offline clientMutationId", async () => {
    noteFindFirst.mockResolvedValueOnce({ id: "note-existing", clientMutationId: "offline-1" });

    const response = await postNote({
      jobId: "job-1",
      type: "GENERAL",
      content: "Offline note",
      category: "Misc",
      createdAt: "2026-05-14T12:00:00.000Z",
      clientMutationId: "offline-1",
    });

    expect(response.status).toBe(200);
    expect(noteFindFirst).toHaveBeenCalledWith({
      where: { companyId: "company-1", clientMutationId: "offline-1" },
    });
    expect(noteCreate).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ id: "note-existing", clientMutationId: "offline-1" });
  });

  it("stores clientMutationId and original capture time for new offline notes", async () => {
    const response = await postNote({
      jobId: "job-1",
      type: "PROGRESS",
      content: "Installed conduit.",
      category: "Completed Work",
      statusTag: "Rough-in",
      createdAt: "2026-05-14T12:00:00.000Z",
      clientMutationId: "offline-2",
    });

    expect(response.status).toBe(201);
    expect(noteCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
        jobId: "job-1",
        authorId: "user-1",
        content: "Installed conduit.",
        createdAt: new Date("2026-05-14T12:00:00.000Z"),
        clientMutationId: "offline-2",
      }),
    });
  });
});
