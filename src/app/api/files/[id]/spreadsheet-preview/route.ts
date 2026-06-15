import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import prisma from "@/lib/prisma";
import {
  accessErrorResponse,
  requireFileAccess,
} from "@/lib/current-user";
import { downloadR2Object } from "@/lib/r2";
import { getFilePreviewInfo } from "@/lib/file-preview";

const MAX_PREVIEW_ROWS = 200;
const MAX_PREVIEW_COLUMNS = 50;

function cellValueToText(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return cellValueToText(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
    if ("hyperlink" in value && "text" in value && typeof value.text === "string") return value.text;
    return "";
  }
  return String(value);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { user } = await requireFileAccess(id);

    const file = await prisma.file.findFirst({
      where: { id, companyId: user.companyId },
      select: {
        id: true,
        url: true,
        originalName: true,
        name: true,
        contentType: true,
      },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const previewInfo = getFilePreviewInfo({
      filename: file.name || file.originalName,
      contentType: file.contentType,
    });

    if (previewInfo.renderMode !== "spreadsheet") {
      return NextResponse.json({ error: "This file type cannot be rendered as a spreadsheet." }, { status: 400 });
    }

    const workbook = new ExcelJS.Workbook();
    const bytes = await downloadR2Object(file.url);
    const workbookBytes = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    await workbook.xlsx.load(workbookBytes);

    const sheets = workbook.worksheets.map((sheet) => {
      const rows: string[][] = [];
      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber > MAX_PREVIEW_ROWS) return;
        const values: string[] = [];
        for (let columnIndex = 1; columnIndex <= Math.min(sheet.columnCount, MAX_PREVIEW_COLUMNS); columnIndex += 1) {
          values.push(cellValueToText(row.getCell(columnIndex).value));
        }
        rows.push(values);
      });

      return { name: sheet.name, rows };
    });

    return NextResponse.json(
      { sheets },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error rendering spreadsheet preview:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
