import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  accessErrorResponse,
  requireCompanyUser,
} from "@/lib/current-user";

export async function GET() {
  try {
    const user = await requireCompanyUser();

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
          }
        }
      }
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json(company);
  } catch (error) {
    const authResponse = accessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Error fetching company:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
