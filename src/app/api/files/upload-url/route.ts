import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  accessErrorResponse,
  requireCompanyUser,
} from "@/lib/current-user";
import { getFileTypeForMime } from "@/lib/asset-categories";
import { createR2ObjectKey, createSignedUploadUrl } from "@/lib/r2";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCompanyUser();
    const { filename, contentType } = await req.json();

    if (!filename || !contentType) {
      return NextResponse.json({ error: "Missing filename or contentType" }, { status: 400 });
    }

    if (!getFileTypeForMime(contentType)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    const fileId = uuidv4();
    const objectKey = createR2ObjectKey(user.companyId, fileId, filename);
    const uploadUrl = await createSignedUploadUrl({ objectKey, contentType });

    return NextResponse.json({
      uploadUrl,
      fileId,
      objectKey,
    });

  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error generating presigned URL:", error);
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
  }
}
