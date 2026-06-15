import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireCompanyUser } from "@/lib/current-user";
import { createWorkspace } from "@/lib/organization";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCompanyUser();
    const workspace = await createWorkspace(user, await req.json());
    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error creating workspace:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
