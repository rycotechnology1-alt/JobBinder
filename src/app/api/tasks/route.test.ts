import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCompanyUser = vi.fn();
const accessErrorResponse = vi.fn();
const jobFindFirst = vi.fn();
const companyMembershipFindFirst = vi.fn();
const taskFindFirst = vi.fn();
const taskCreate = vi.fn();
const taskUpdate = vi.fn();
const taskFileUpdateMany = vi.fn();
const markupMarkFindFirst = vi.fn();

vi.mock("@/lib/current-user", () => ({
  requireCompanyUser,
  accessErrorResponse,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    job: {
      findFirst: jobFindFirst,
    },
    companyMembership: {
      findFirst: companyMembershipFindFirst,
    },
    task: {
      findFirst: taskFindFirst,
      create: taskCreate,
      update: taskUpdate,
    },
    file: {
      updateMany: taskFileUpdateMany,
    },
    fileMarkupMark: {
      findFirst: markupMarkFindFirst,
    },
  },
}));

async function postTask(body: unknown) {
  const { POST } = await import("./route");
  return POST(new NextRequest("http://localhost/api/tasks", {
    method: "POST",
    body: JSON.stringify(body),
  }));
}

async function patchTask(body: unknown) {
  const { PATCH } = await import("./route");
  return PATCH(new NextRequest("http://localhost/api/tasks", {
    method: "PATCH",
    body: JSON.stringify(body),
  }));
}

describe("/api/tasks", () => {
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
    companyMembershipFindFirst.mockResolvedValue({ id: "membership-2" });
    taskFindFirst.mockResolvedValue({ id: "task-1", jobId: "job-1" });
    taskCreate.mockResolvedValue({
      id: "task-1",
      title: "Install trim",
      type: "TASK",
      status: "OPEN",
    });
    taskUpdate.mockResolvedValue({
      id: "task-1",
      status: "IN_PROGRESS",
    });
    taskFileUpdateMany.mockResolvedValue({ count: 1 });
    markupMarkFindFirst.mockResolvedValue({
      id: "mark-1",
      kind: "PIN",
      file: { id: "file-1", jobId: "job-1" },
    });
  });

  it("creates a company-scoped task after verifying job ownership", async () => {
    const response = await postTask({
      jobId: "job-1",
      title: "  Install trim  ",
      description: "  North wall  ",
      type: "PUNCH_LIST",
      dueDate: "2026-06-15",
    });

    expect(response.status).toBe(201);
    expect(jobFindFirst).toHaveBeenCalledWith({
      where: { id: "job-1", companyId: "company-1" },
      select: { id: true },
    });
    expect(taskCreate).toHaveBeenCalledWith({
      data: {
        companyId: "company-1",
        jobId: "job-1",
        title: "Install trim",
        description: "North wall",
        type: "PUNCH_LIST",
        dueDate: new Date("2026-06-15"),
        createdById: "user-1",
        assignedToId: undefined,
      },
    });
  });

  it("returns an existing task for a repeated offline clientMutationId", async () => {
    taskFindFirst.mockResolvedValueOnce({ id: "task-existing", clientMutationId: "offline-1" });

    const response = await postTask({
      jobId: "job-1",
      title: "Offline punch",
      type: "PUNCH_LIST",
      createdAt: "2026-05-14T12:00:00.000Z",
      clientMutationId: "offline-1",
    });

    expect(response.status).toBe(200);
    expect(taskFindFirst).toHaveBeenCalledWith({
      where: { companyId: "company-1", clientMutationId: "offline-1" },
    });
    expect(taskCreate).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ id: "task-existing", clientMutationId: "offline-1" });
  });

  it("stores clientMutationId and original capture time for new offline tasks", async () => {
    taskFindFirst.mockResolvedValueOnce(null);

    const response = await postTask({
      jobId: "job-1",
      title: "Offline task",
      description: "Captured at the site",
      type: "TASK",
      createdAt: "2026-05-14T12:00:00.000Z",
      clientMutationId: "offline-2",
    });

    expect(response.status).toBe(201);
    expect(taskCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
        jobId: "job-1",
        title: "Offline task",
        createdAt: new Date("2026-05-14T12:00:00.000Z"),
        clientMutationId: "offline-2",
      }),
    });
  });

  it("creates a linked task from a pinned markup comment and links existing pin images", async () => {
    taskFindFirst.mockResolvedValueOnce(null);
    taskCreate.mockResolvedValueOnce({
      id: "task-from-pin",
      title: "Fix missing caulk",
      type: "TASK",
      status: "OPEN",
      sourceMarkupMarkId: "mark-1",
    });

    const response = await postTask({
      sourceMarkupMarkId: "mark-1",
      title: "Fix missing caulk",
      description: "Pin 1: missing caulk at sill",
      type: "TASK",
      dueDate: "2026-06-20",
    });

    expect(response.status).toBe(201);
    expect(markupMarkFindFirst).toHaveBeenCalledWith({
      where: { id: "mark-1", companyId: "company-1", kind: "PIN", deletedAt: null },
      select: { id: true, file: { select: { id: true, jobId: true } } },
    });
    expect(jobFindFirst).toHaveBeenCalledWith({
      where: { id: "job-1", companyId: "company-1" },
      select: { id: true },
    });
    expect(taskCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
        jobId: "job-1",
        title: "Fix missing caulk",
        sourceMarkupMarkId: "mark-1",
      }),
    });
    expect(taskFileUpdateMany).toHaveBeenCalledWith({
      where: { companyId: "company-1", markupMarkId: "mark-1" },
      data: { taskId: "task-from-pin" },
    });
  });

  it("returns an existing source-pin task instead of creating a duplicate", async () => {
    taskFindFirst.mockResolvedValueOnce({ id: "task-existing", sourceMarkupMarkId: "mark-1" });

    const response = await postTask({
      sourceMarkupMarkId: "mark-1",
      title: "Fix missing caulk",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "task-existing", sourceMarkupMarkId: "mark-1" });
    expect(taskCreate).not.toHaveBeenCalled();
    expect(taskFileUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects invalid create payloads and unknown jobs", async () => {
    const missingFields = await postTask({ jobId: "job-1", title: " " });
    expect(missingFields.status).toBe(400);
    expect(await missingFields.json()).toEqual({ error: "Missing required fields" });

    const invalidType = await postTask({ jobId: "job-1", title: "Task", type: "REMINDER" });
    expect(invalidType.status).toBe(400);
    expect(await invalidType.json()).toEqual({ error: "Invalid task type" });

    jobFindFirst.mockResolvedValueOnce(null);
    const missingJob = await postTask({ jobId: "other-job", title: "Task" });
    expect(missingJob.status).toBe(404);
    expect(await missingJob.json()).toEqual({ error: "Job not found" });
  });

  it("updates a company-scoped task status", async () => {
    const response = await patchTask({ id: "task-1", status: "IN_PROGRESS" });

    expect(response.status).toBe(200);
    expect(taskFindFirst).toHaveBeenCalledWith({
      where: { id: "task-1", companyId: "company-1" },
      select: { id: true, jobId: true },
    });
    expect(taskUpdate).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: { status: "IN_PROGRESS" },
    });
  });

  it("rejects invalid status updates and unknown tasks", async () => {
    const missingStatus = await patchTask({ id: "task-1" });
    expect(missingStatus.status).toBe(400);
    expect(await missingStatus.json()).toEqual({ error: "Missing id or status" });

    const invalidStatus = await patchTask({ id: "task-1", status: "ARCHIVED" });
    expect(invalidStatus.status).toBe(400);
    expect(await invalidStatus.json()).toEqual({ error: "Invalid task status" });

    taskFindFirst.mockResolvedValueOnce(null);
    const missingTask = await patchTask({ id: "other-task", status: "DONE" });
    expect(missingTask.status).toBe(404);
    expect(await missingTask.json()).toEqual({ error: "Task not found" });
  });
});
