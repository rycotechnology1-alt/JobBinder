import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireCompanyUser } from "@/lib/current-user";
import { createOrgUnit } from "@/lib/organization";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCompanyUser();
    const orgUnit = await createOrgUnit(user, await req.json());
    return NextResponse.json(orgUnit, { status: 201 });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error creating organization unit:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
