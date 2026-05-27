import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCompanyUser = vi.fn();
const accessErrorResponse = vi.fn();
const fileFindFirst = vi.fn();
const downloadR2Object = vi.fn();

vi.mock("@/lib/current-user", () => ({
  requireCompanyUser,
  accessErrorResponse,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    file: {
      findFirst: fileFindFirst,
    },
  },
}));

vi.mock("@/lib/r2", () => ({
  downloadR2Object,
}));

async function getContent(id = "file-1", query = "") {
  const { GET } = await import("./route");
  return GET(new NextRequest(`http://localhost/api/files/${id}/content${query}`), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /api/files/[id]/content", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCompanyUser.mockResolvedValue({ id: "user-1", companyId: "company-1" });
    accessErrorResponse.mockReturnValue(null);
    fileFindFirst.mockResolvedValue({
      id: "file-1",
      url: "company-1/file-1.pdf",
      originalName: "permit.pdf",
      name: "Permit",
      contentType: "application/pdf",
    });
    downloadR2Object.mockResolvedValue(Buffer.from("PDF"));
  });

  it("streams a company-scoped file through an authenticated same-origin route", async () => {
    const response = await getContent();

    expect(response.status).toBe(200);
    expect(fileFindFirst).toHaveBeenCalledWith({
      where: { id: "file-1", companyId: "company-1" },
      select: expect.objectContaining({ id: true, url: true, contentType: true }),
    });
    expect(downloadR2Object).toHaveBeenCalledWith("company-1/file-1.pdf");
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("inline");
    expect(await response.text()).toBe("PDF");
  });

  it("uses attachment disposition for explicit downloads", async () => {
    fileFindFirst.mockResolvedValueOnce({
      id: "file-1",
      url: "company-1/file-1.xlsx",
      originalName: "00 - Job Text Items.xlsx",
      name: "test xlsx doc",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const response = await getContent("file-1", "?download=1");

    expect(response.headers.get("Content-Disposition")).toContain("attachment");
    expect(response.headers.get("Content-Disposition")).toContain("test xlsx doc.xlsx");
  });

  it("rejects files outside the user's company", async () => {
    fileFindFirst.mockResolvedValueOnce(null);

    const response = await getContent("other-file");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "File not found" });
    expect(downloadR2Object).not.toHaveBeenCalled();
  });

  it("returns auth errors before storage access", async () => {
    requireCompanyUser.mockRejectedValueOnce(new Error("Unauthorized"));
    accessErrorResponse.mockReturnValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const response = await getContent();

    expect(response.status).toBe(401);
    expect(downloadR2Object).not.toHaveBeenCalled();
  });
});
