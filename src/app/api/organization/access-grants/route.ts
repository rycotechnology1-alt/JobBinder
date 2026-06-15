import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireCompanyUser } from "@/lib/current-user";
import { createAccessGrant } from "@/lib/organization";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCompanyUser();
    const grant = await createAccessGrant(user, await req.json());
    return NextResponse.json(grant, { status: 201 });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error creating access grant:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
