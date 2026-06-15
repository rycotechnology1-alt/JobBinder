import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireCompanyUser } from "@/lib/current-user";
import { resendOrganizationInvite } from "@/lib/organization";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanyUser();
    const { id } = await params;
    const result = await resendOrganizationInvite(user, id);
    return NextResponse.json(result);
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error resending invite:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
