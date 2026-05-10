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

  await prisma.company.create({
    data: {
      name: companyName.trim(),
      plan: "FREE",
      users: {
        connect: { id: user.id },
      },
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      role: "ADMIN",
      name: user.name ?? user.email?.split("@")[0] ?? "Owner",
    },
  });

  redirect("/");
}
