import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";

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

async function createWorkbookBuffer() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Items");
  sheet.addRow(["Name", "Qty"]);
  sheet.addRow(["Outlet", 4]);
  const bytes = await workbook.xlsx.writeBuffer();
  return Buffer.from(bytes);
}

async function getSpreadsheetPreview(id = "file-1") {
  const { GET } = await import("./route");
  return GET(new NextRequest(`http://localhost/api/files/${id}/spreadsheet-preview`), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /api/files/[id]/spreadsheet-preview", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    requireCompanyUser.mockResolvedValue({ id: "user-1", companyId: "company-1" });
    accessErrorResponse.mockReturnValue(null);
    fileFindFirst.mockResolvedValue({
      id: "file-1",
      url: "company-1/file-1.xlsx",
      originalName: "00 - Job Text Items.xlsx",
      name: "test xlsx doc",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadR2Object.mockResolvedValue(await createWorkbookBuffer());
  });

  it("returns copyable workbook data for company-scoped XLSX files", async () => {
    const response = await getSpreadsheetPreview();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      sheets: [
        {
          name: "Items",
          rows: [
            ["Name", "Qty"],
            ["Outlet", "4"],
          ],
        },
      ],
    });
  });

  it("rejects files outside the user's company", async () => {
    fileFindFirst.mockResolvedValueOnce(null);

    const response = await getSpreadsheetPreview("other-file");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "File not found" });
    expect(downloadR2Object).not.toHaveBeenCalled();
  });
});
