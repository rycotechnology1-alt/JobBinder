import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireCompanyUser } from "@/lib/current-user";
import { deleteAccessGrant } from "@/lib/organization";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanyUser();
    const { id } = await params;
    const result = await deleteAccessGrant(user, id);
    return NextResponse.json(result);
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error deleting access grant:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
