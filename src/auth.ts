import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";
import { normalizeInviteEmail } from "@/lib/auth-rules";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret:
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    (process.env.NODE_ENV === "development"
      ? "jobbinder-development-secret"
      : undefined),
  trustHost: true,
  pages: {
    signIn: "/sign-in",
    verifyRequest: "/check-email",
  },
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY,
      from:
        process.env.AUTH_EMAIL_FROM ??
        "JobBinder <invites@jobbinder.app>",
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (!session.user) return session;

      const appUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          companyId: true,
          email: true,
          name: true,
          role: true,
        },
      });

      if (!appUser) return session;

      session.user.id = appUser.id;
      session.user.companyId = appUser.companyId;
      session.user.role = appUser.role;
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.email || !user.id) return;

      const email = normalizeInviteEmail(user.email);
      const appUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { companyId: true, name: true },
      });

      if (!appUser || appUser.companyId) return;

      const invite = await prisma.invite.findFirst({
        where: {
          email,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!invite) return;

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            companyId: invite.companyId,
            role: invite.role,
            name: appUser.name ?? email.split("@")[0],
          },
        }),
        prisma.invite.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date() },
        }),
      ]);
    },
  },
});
