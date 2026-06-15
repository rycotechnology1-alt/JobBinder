import { NextRequest, NextResponse } from "next/server";
import {
  accessErrorResponse,
  requireCompanyUser,
} from "@/lib/current-user";
import { createOrganizationInvite } from "@/lib/organization";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCompanyUser();
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    await createOrganizationInvite(user, body);

    return NextResponse.json({
      success: true,
      message: "Invite email sent",
    });

  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error sending invite:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
