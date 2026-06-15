import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      companyId: string | null;
      membershipId: string | null;
      role: Role;
      hasActiveMembership: boolean;
      emailVerified: Date | null;
    } & DefaultSession["user"];
  }
}
