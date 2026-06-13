import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCompanyUser = vi.fn();
const accessErrorResponse = vi.fn();
const createR2ObjectKey = vi.fn();
const createSignedUploadUrl = vi.fn();

vi.mock("@/lib/current-user", () => ({
  requireCompanyUser,
  accessErrorResponse,
}));

vi.mock("@/lib/r2", () => ({
  createR2ObjectKey,
  createSignedUploadUrl,
}));

async function postUploadUrl(body: unknown) {
  const { POST } = await import("./route");
  return POST(new NextRequest("http://localhost/api/files/upload-url", {
    method: "POST",
    body: JSON.stringify(body),
  }));
}

describe("POST /api/files/upload-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCompanyUser.mockResolvedValue({ id: "user-1", companyId: "company-1" });
    accessErrorResponse.mockReturnValue(null);
    createR2ObjectKey.mockReturnValue("company-1/file-1.pdf");
    createSignedUploadUrl.mockResolvedValue("https://r2.example.com/upload");
  });

  it("rejects legacy DOC uploads before creating a signed upload URL", async () => {
    const response = await postUploadUrl({
      filename: "legacy.doc",
      contentType: "application/msword",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Legacy .doc files are not supported. Convert the document to .docx before uploading.",
    });
    expect(createR2ObjectKey).not.toHaveBeenCalled();
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });
});
