import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireCompanyUser } from "@/lib/current-user";
import { setCrewMember } from "@/lib/organization";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanyUser();
    const { id } = await params;
    const result = await setCrewMember(user, id, await req.json());
    return NextResponse.json(result);
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error updating crew members:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
