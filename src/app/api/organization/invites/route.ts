import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireCompanyUser } from "@/lib/current-user";
import { createOrganizationInvite } from "@/lib/organization";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCompanyUser();
    const invite = await createOrganizationInvite(user, await req.json());
    return NextResponse.json(invite, { status: 201 });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error creating organization invite:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
