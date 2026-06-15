import { NextResponse } from "next/server";
import { accessErrorResponse, requireCompanyUser } from "@/lib/current-user";
import { getOrganizationSnapshot } from "@/lib/organization";

export async function GET() {
  try {
    const user = await requireCompanyUser();
    const organization = await getOrganizationSnapshot(user);
    return NextResponse.json(organization);
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error loading organization:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
