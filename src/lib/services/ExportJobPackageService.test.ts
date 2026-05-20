import { describe, expect, it } from "vitest";
import { ExportJobPackageService, ExportItem } from "./ExportJobPackageService";

describe("ExportJobPackageService Naming and Sanitization", () => {
  it("sanitizes invalid characters in filenames", () => {
    const items: ExportItem[] = [
      {
        id: "1",
        category: "Photos",
        itemType: "FILE",
        createdAt: "2026-05-20T12:00:00Z",
        createdBy: "User",
        title: "Trench *condition* near pole / driveway?",
        originalFileName: "IMG_4421.jpg",
        exportedFileName: "",
        folderPath: "01 - Photos",
      },
    ];

    ExportJobPackageService.resolveExportFileNames(items, true);

    expect(items[0].exportedFileName).not.toContain("*");
    expect(items[0].exportedFileName).not.toContain("/");
    expect(items[0].exportedFileName).not.toContain("?");
    expect(items[0].exportedFileName).toBe(
      "2026-05-20 - Photos - Trench -condition- near pole - driveway- - IMG_4421.jpg",
    );
  });

  it("resolves duplicate file names within the same folder path", () => {
    const items: ExportItem[] = [
      {
        id: "1",
        category: "Photos",
        itemType: "FILE",
        createdAt: "2026-05-20T12:00:00Z",
        createdBy: "User",
        title: "Trench",
        originalFileName: "IMG_4421.jpg",
        exportedFileName: "",
        folderPath: "01 - Photos",
      },
      {
        id: "2",
        category: "Photos",
        itemType: "FILE",
        createdAt: "2026-05-20T12:00:00Z",
        createdBy: "User",
        title: "Trench",
        originalFileName: "IMG_4421.jpg",
        exportedFileName: "",
        folderPath: "01 - Photos",
      },
      {
        id: "3",
        category: "Photos",
        itemType: "FILE",
        createdAt: "2026-05-20T12:00:00Z",
        createdBy: "User",
        title: "Trench",
        originalFileName: "IMG_4421.jpg",
        exportedFileName: "",
        folderPath: "01 - Photos",
      },
    ];

    ExportJobPackageService.resolveExportFileNames(items, true);

    expect(items[0].exportedFileName).toBe("2026-05-20 - Photos - Trench - IMG_4421.jpg");
    expect(items[1].exportedFileName).toBe("2026-05-20 - Photos - Trench - IMG_4421 (2).jpg");
    expect(items[2].exportedFileName).toBe("2026-05-20 - Photos - Trench - IMG_4421 (3).jpg");
  });

  it("keeps original filename if renameFilesForReadability is false", () => {
    const items: ExportItem[] = [
      {
        id: "1",
        category: "Photos",
        itemType: "FILE",
        createdAt: "2026-05-20T12:00:00Z",
        createdBy: "User",
        title: "Trench",
        originalFileName: "IMG_4421.jpg",
        exportedFileName: "",
        folderPath: "01 - Photos",
      },
    ];

    ExportJobPackageService.resolveExportFileNames(items, false);

    expect(items[0].exportedFileName).toBe("IMG_4421.jpg");
  });
});
