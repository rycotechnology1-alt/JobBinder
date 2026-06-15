import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireCompanyUser } from "@/lib/current-user";
import { updateCrew } from "@/lib/organization";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanyUser();
    const { id } = await params;
    const crew = await updateCrew(user, id, await req.json());
    return NextResponse.json(crew);
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error updating crew:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
