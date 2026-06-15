import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireCompanyUser } from "@/lib/current-user";
import { createCrew } from "@/lib/organization";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCompanyUser();
    const crew = await createCrew(user, await req.json());
    return NextResponse.json(crew, { status: 201 });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error creating crew:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
