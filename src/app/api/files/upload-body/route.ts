import { NextRequest, NextResponse } from "next/server";
import {
  accessErrorResponse,
  requireCompanyUser,
} from "@/lib/current-user";
import { getFileTypeForMime } from "@/lib/asset-categories";
import { isCompanyScopedObjectKey, uploadR2Object } from "@/lib/r2";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCompanyUser();
    const objectKey = req.headers.get("x-object-key")?.trim() || "";
    const contentType = req.headers.get("content-type")?.trim().toLowerCase() || "";

    if (!objectKey || !contentType) {
      return NextResponse.json({ error: "Missing object key or contentType" }, { status: 400 });
    }

    if (!getFileTypeForMime(contentType)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    if (!isCompanyScopedObjectKey(objectKey, user.companyId)) {
      return NextResponse.json({ error: "Object key is outside company storage" }, { status: 403 });
    }

    const bytes = Buffer.from(await req.arrayBuffer());
    if (bytes.length === 0) {
      return NextResponse.json({ error: "Missing file body" }, { status: 400 });
    }

    await uploadR2Object(objectKey, bytes, contentType);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error uploading file body:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
