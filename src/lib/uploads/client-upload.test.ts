import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadFileRecord } from "./client-upload";

describe("uploadFileRecord", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url === "/api/files/upload-url") {
          expect(init?.method).toBe("POST");
          return {
            ok: true,
            json: async () => ({
              uploadUrl: "https://r2.example/upload",
              objectKey: "company-1/pin-photo.jpg",
            }),
          } as Response;
        }

        if (url === "https://r2.example/upload") {
          expect(init?.method).toBe("PUT");
          return { ok: true } as Response;
        }

        if (url === "/api/files") {
          expect(init?.method).toBe("POST");
          return {
            ok: true,
            json: async () => ({ id: "file-1" }),
          } as Response;
        }

        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );
  });

  it("includes task and markup pin links when saving the file record", async () => {
    const body = new Blob(["image"], { type: "image/jpeg" });

    await uploadFileRecord({
      taskId: "task-1",
      markupMarkId: "mark-1",
      originalName: "pin-photo.jpg",
      name: "Pin photo",
      category: "Issue",
      prepared: {
        sourceFile: { name: "pin-photo.jpg" } as File,
        body,
        contentType: "image/jpeg",
      },
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/files",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          jobId: undefined,
          noteId: undefined,
          taskId: "task-1",
          markupMarkId: "mark-1",
          objectKey: "company-1/pin-photo.jpg",
          originalName: "pin-photo.jpg",
          name: "Pin photo",
          contentType: "image/jpeg",
          sizeBytes: body.size,
          category: "Issue",
        }),
      }),
    );
  });
});
