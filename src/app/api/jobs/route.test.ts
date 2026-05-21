import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCompanyUser = vi.fn();
const accessErrorResponse = vi.fn();
const findMany = vi.fn();
const findFirst = vi.fn();
const update = vi.fn();

vi.mock("@/lib/current-user", () => ({
  requireCompanyUser,
  accessErrorResponse,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    job: {
      findMany,
      findFirst,
      create: vi.fn(),
      update,
    },
  },
}));

async function patchJob(body: unknown) {
  const { PATCH } = await import("./route");
  return PATCH(new NextRequest("http://localhost/api/jobs", {
    method: "PATCH",
    body: JSON.stringify(body),
  }));
}

async function getJobs(url = "http://localhost/api/jobs") {
  const { GET } = await import("./route");
  return GET(new NextRequest(url));
}

describe("GET /api/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCompanyUser.mockResolvedValue({ id: "admin-1", companyId: "company-1", role: "ADMIN" });
    accessErrorResponse.mockReturnValue(null);
    findMany.mockResolvedValue([]);
  });

  it("filters dashboard jobs by search across title, customer, PO number, and job number", async () => {
    const response = await getJobs("http://localhost/api/jobs?search=PO-42");

    expect(response.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        companyId: "company-1",
        OR: [
          { title: { contains: "PO-42", mode: "insensitive" } },
          { customerName: { contains: "PO-42", mode: "insensitive" } },
          { poNumber: { contains: "PO-42", mode: "insensitive" } },
          { jobNumber: { contains: "PO-42", mode: "insensitive" } },
        ],
      },
    }));
  });

  it("maps grouped dashboard status filters for active, delay, and complete jobs", async () => {
    await getJobs("http://localhost/api/jobs?status=active");
    expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: {
        companyId: "company-1",
        status: { in: ["DESIGN", "ACTIVE", "PUNCH_LIST", "FINAL_BILL_SUBMITTED"] },
      },
    }));

    await getJobs("http://localhost/api/jobs?status=delay");
    expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { companyId: "company-1", status: "DELAY" },
    }));

    await getJobs("http://localhost/api/jobs?status=complete");
    expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { companyId: "company-1", status: "COMPLETE" },
    }));
  });

  it("keeps company scoping and treats invalid grouped status filters as all jobs", async () => {
    await getJobs("http://localhost/api/jobs?status=ARCHIVED");

    expect(requireCompanyUser).toHaveBeenCalledOnce();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { companyId: "company-1" },
    }));
  });
});

describe("PATCH /api/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCompanyUser.mockResolvedValue({ id: "admin-1", companyId: "company-1", role: "ADMIN" });
    accessErrorResponse.mockReturnValue(null);
    findFirst.mockResolvedValue({ id: "job-1" });
    update.mockResolvedValue({
      id: "job-1",
      title: "Renovation",
      poNumber: null,
      status: "FINAL_BILL_SUBMITTED",
      priority: 4,
    });
  });

  it("updates allowed job fields after verifying company ownership", async () => {
    const response = await patchJob({
      id: "job-1",
      title: "  Renovation  ",
      jobNumber: "  J-42 ",
      poNumber: "   ",
      contractNumber: " C-9 ",
      customerName: " Acme ",
      address: " 10 Main St ",
      contactName: " Sam ",
      contactPhone: " 555-0100 ",
      contactEmail: " sam@example.com ",
      description: " Near closeout ",
      status: "FINAL_BILL_SUBMITTED",
      priority: 4,
      targetCompletionDate: "2026-06-01",
      ignoredField: "do not save",
    });

    expect(response.status).toBe(200);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "job-1", companyId: "company-1" },
      select: { id: true },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: {
        title: "Renovation",
        jobNumber: "J-42",
        poNumber: null,
        contractNumber: "C-9",
        customerName: "Acme",
        address: "10 Main St",
        contactName: "Sam",
        contactPhone: "555-0100",
        contactEmail: "sam@example.com",
        description: "Near closeout",
        status: "FINAL_BILL_SUBMITTED",
        priority: 4,
        targetCompletionDate: new Date("2026-06-01T00:00:00.000Z"),
      },
    });
  });

  it("lets members update basic job fields without management fields", async () => {
    requireCompanyUser.mockResolvedValue({ id: "user-1", companyId: "company-1", role: "MEMBER" });

    const response = await patchJob({
      id: "job-1",
      title: "  Updated title  ",
      customerName: " Acme ",
    });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: {
        title: "Updated title",
        customerName: "Acme",
      },
    });
  });

  it("rejects member attempts to update management fields", async () => {
    requireCompanyUser.mockResolvedValue({ id: "user-1", companyId: "company-1", role: "MEMBER" });

    const statusResponse = await patchJob({ id: "job-1", status: "DELAY" });
    expect(statusResponse.status).toBe(403);
    expect(await statusResponse.json()).toEqual({ error: "Admin access required" });

    const priorityResponse = await patchJob({ id: "job-1", priority: 4 });
    expect(priorityResponse.status).toBe(403);
    expect(await priorityResponse.json()).toEqual({ error: "Admin access required" });

    const targetResponse = await patchJob({ id: "job-1", targetCompletionDate: "2026-06-01" });
    expect(targetResponse.status).toBe(403);
    expect(await targetResponse.json()).toEqual({ error: "Admin access required" });

    expect(update).not.toHaveBeenCalled();
  });

  it("lets admins update management fields", async () => {
    requireCompanyUser.mockResolvedValue({ id: "admin-1", companyId: "company-1", role: "ADMIN" });

    const response = await patchJob({
      id: "job-1",
      status: "DELAY",
      priority: 4,
      targetCompletionDate: "2026-06-01",
    });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: {
        status: "DELAY",
        priority: 4,
        targetCompletionDate: new Date("2026-06-01T00:00:00.000Z"),
      },
    });
  });

  it("rejects missing id and invalid management fields", async () => {
    const missingId = await patchJob({ title: "No id" });
    expect(missingId.status).toBe(400);
    expect(await missingId.json()).toEqual({ error: "Missing job id" });

    const invalidStatus = await patchJob({ id: "job-1", status: "ARCHIVED" });
    expect(invalidStatus.status).toBe(400);
    expect(await invalidStatus.json()).toEqual({ error: "Invalid job status" });

    const invalidPriority = await patchJob({ id: "job-1", priority: 5 });
    expect(invalidPriority.status).toBe(400);
    expect(await invalidPriority.json()).toEqual({ error: "Invalid priority" });

    const invalidDate = await patchJob({ id: "job-1", targetCompletionDate: "bad-date" });
    expect(invalidDate.status).toBe(400);
    expect(await invalidDate.json()).toEqual({ error: "Invalid target completion date" });
  });

  it("rejects invalid contact email and company mismatches", async () => {
    const invalidEmail = await patchJob({ id: "job-1", contactEmail: "not-email" });
    expect(invalidEmail.status).toBe(400);
    expect(await invalidEmail.json()).toEqual({ error: "Invalid contact email" });

    findFirst.mockResolvedValueOnce(null);
    const missingJob = await patchJob({ id: "other-job", title: "Other" });
    expect(missingJob.status).toBe(404);
    expect(await missingJob.json()).toEqual({ error: "Job not found" });
    expect(update).not.toHaveBeenCalled();
  });
});
