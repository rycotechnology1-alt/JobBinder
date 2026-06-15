"use server";

import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";

export async function createCompany(formData: FormData) {
  const user = await requireCurrentUser();
  const companyName = formData.get("companyName");

  if (typeof companyName !== "string" || !companyName.trim()) {
    return;
  }

  if (user.companyId) {
    redirect("/");
  }

  const trimmedCompanyName = companyName.trim();

  await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: trimmedCompanyName,
        plan: "FREE",
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: {
        companyId: company.id,
        role: "OWNER",
        name: user.name ?? user.email?.split("@")[0] ?? "Owner",
      },
    });

    await tx.companyMembership.create({
      data: {
        companyId: company.id,
        userId: user.id,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    const orgUnit = await tx.orgUnit.create({
      data: {
        companyId: company.id,
        name: trimmedCompanyName,
        kind: "COMPANY",
      },
    });

    await tx.workspace.create({
      data: {
        companyId: company.id,
        orgUnitId: orgUnit.id,
        name: "Main Workspace",
      },
    });
  });

  redirect("/");
}
