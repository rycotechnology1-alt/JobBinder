import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { normalizeAuthEmail } from "@/lib/auth-rules";
import { verifyPassword } from "@/lib/auth-password";

const useSecureCookies = process.env.NODE_ENV === "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret:
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    (process.env.NODE_ENV === "development"
      ? "jobbinder-development-secret"
      : undefined),
  trustHost: true,
  pages: {
    signIn: "/sign-in",
  },
  session: {
    strategy: "jwt",
  },
  cookies: {
    sessionToken: {
      name: `${useSecureCookies ? "__Secure-" : ""}jobbinder.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string"
            ? normalizeAuthEmail(credentials.email)
            : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            hashedPassword: true,
          },
        });

        if (!user?.hashedPassword) return null;

        const passwordMatches = await verifyPassword(password, user.hashedPassword);
        if (!passwordMatches) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }

      return token;
    },
    async session({ session, token }) {
      if (!session.user || !token.sub) return session;

      const appUser = await prisma.user.findUnique({
        where: { id: token.sub },
        select: {
          id: true,
          companyId: true,
          email: true,
          emailVerified: true,
          name: true,
          role: true,
          memberships: {
            where: { status: "ACTIVE" },
            orderBy: { joinedAt: "asc" },
            select: {
              id: true,
              companyId: true,
              role: true,
            },
          },
        },
      });

      if (!appUser) return session;

      const activeMembership = appUser.memberships[0] ?? null;

      session.user.id = appUser.id;
      session.user.companyId = activeMembership?.companyId ?? appUser.companyId;
      session.user.membershipId = activeMembership?.id ?? null;
      session.user.role = activeMembership?.role ?? appUser.role;
      session.user.hasActiveMembership = Boolean(activeMembership);
      session.user.emailVerified = appUser.emailVerified;
      return session;
    },
  },
});
