import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCompanyUser = vi.fn();
const accessErrorResponse = vi.fn();
const jobFindFirst = vi.fn();
const noteFindFirst = vi.fn();
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
    },
  },
}));

async function postDailyReport(body: unknown) {
  const { POST } = await import("./route");
  return POST(new NextRequest("http://localhost/api/daily-reports", {
    method: "POST",
    body: JSON.stringify(body),
  }));
}

describe("POST /api/daily-reports", () => {
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
    noteCreate.mockResolvedValue({
      id: "report-1",
      type: "DAILY_REPORT",
      content: "Installed conduit.",
      reportDate: new Date("2026-06-14T00:00:00.000Z"),
      materialsUsed: "2 EMT sticks",
    });
  });

  it("creates a company-scoped daily report with report date, work performed, and materials used", async () => {
    const response = await postDailyReport({
      jobId: "job-1",
      reportDate: "2026-06-14",
      workPerformed: "Installed conduit.",
      materialsUsed: "2 EMT sticks",
      clientMutationId: "offline-report-1",
    });

    expect(response.status).toBe(201);
    expect(jobFindFirst).toHaveBeenCalledWith({
      where: { id: "job-1", companyId: "company-1" },
      select: { id: true },
    });
    expect(noteCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
        jobId: "job-1",
        authorId: "user-1",
        type: "DAILY_REPORT",
        content: "Installed conduit.",
        reportDate: new Date("2026-06-14T00:00:00.000Z"),
        materialsUsed: "2 EMT sticks",
        clientMutationId: "offline-report-1",
      }),
    });
  });

  it("returns an existing daily report for a repeated clientMutationId", async () => {
    noteFindFirst.mockResolvedValueOnce({ id: "report-existing", clientMutationId: "offline-report-1" });

    const response = await postDailyReport({
      jobId: "job-1",
      reportDate: "2026-06-14",
      workPerformed: "Installed conduit.",
      clientMutationId: "offline-report-1",
    });

    expect(response.status).toBe(200);
    expect(noteFindFirst).toHaveBeenCalledWith({
      where: { companyId: "company-1", clientMutationId: "offline-report-1" },
    });
    expect(noteCreate).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ id: "report-existing", clientMutationId: "offline-report-1" });
  });

  it("rejects missing work, invalid report dates, and unknown jobs", async () => {
    const missingWork = await postDailyReport({
      jobId: "job-1",
      reportDate: "2026-06-14",
      workPerformed: "",
    });
    expect(missingWork.status).toBe(400);
    expect(await missingWork.json()).toEqual({ error: "Work performed is required." });

    const invalidDate = await postDailyReport({
      jobId: "job-1",
      reportDate: "06/14/2026",
      workPerformed: "Installed conduit.",
    });
    expect(invalidDate.status).toBe(400);
    expect(await invalidDate.json()).toEqual({ error: "Report date must be YYYY-MM-DD." });

    jobFindFirst.mockResolvedValueOnce(null);
    const missingJob = await postDailyReport({
      jobId: "job-missing",
      reportDate: "2026-06-14",
      workPerformed: "Installed conduit.",
    });
    expect(missingJob.status).toBe(404);
    expect(await missingJob.json()).toEqual({ error: "Job not found" });
    expect(noteCreate).not.toHaveBeenCalled();
  });
});
