import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCompanyUser = vi.fn();
const accessErrorResponse = vi.fn();
const isCompanyScopedObjectKey = vi.fn();
const uploadR2Object = vi.fn();

vi.mock("@/lib/current-user", () => ({
  requireCompanyUser,
  accessErrorResponse,
}));

vi.mock("@/lib/r2", () => ({
  isCompanyScopedObjectKey,
  uploadR2Object,
}));

async function postUploadBody(body: BodyInit, headers: Record<string, string>) {
  const { POST } = await import("./route");
  return POST(new NextRequest("http://localhost/api/files/upload-body", {
    method: "POST",
    headers,
    body,
  }));
}

describe("POST /api/files/upload-body", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCompanyUser.mockResolvedValue({ id: "user-1", companyId: "company-1" });
    accessErrorResponse.mockReturnValue(null);
    isCompanyScopedObjectKey.mockReturnValue(true);
  });

  it("uploads a supported company-scoped object body to R2", async () => {
    const response = await postUploadBody("pdf-data", {
      "Content-Type": "application/pdf",
      "X-Object-Key": "company-1/file.pdf",
    });

    expect(response.status).toBe(204);
    expect(uploadR2Object).toHaveBeenCalledWith(
      "company-1/file.pdf",
      expect.any(Buffer),
      "application/pdf",
    );
  });

  it("rejects object keys outside the user's company storage", async () => {
    isCompanyScopedObjectKey.mockReturnValue(false);

    const response = await postUploadBody("pdf-data", {
      "Content-Type": "application/pdf",
      "X-Object-Key": "other-company/file.pdf",
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Object key is outside company storage" });
    expect(uploadR2Object).not.toHaveBeenCalled();
  });
});
