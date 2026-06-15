import Link from "next/link";
import { HardHat } from "lucide-react";
import { signOut } from "@/auth";
import { getCurrentAppUser } from "@/lib/current-user";
import { isAccountManagerRole } from "@/lib/account-access";
import { AccountMenu } from "@/components/AccountMenu";
import { NavLinks } from "@/components/NavLinks";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";

export async function Navbar() {
  const user = await getCurrentAppUser();
  const hasVerifiedCompany = Boolean(user?.companyId && user.emailVerified);
  const canManageOrganization = Boolean(user && isAccountManagerRole(user.role));
  const accounts = user?.memberships.map((membership) => ({
    companyId: membership.companyId,
    companyName: membership.company.name,
    role: membership.role,
    isActive: membership.companyId === user.companyId,
  })) ?? [];

  async function handleSignOut() {
    "use server";

    await signOut({ redirectTo: "/sign-in" });
  }

  return (
    <nav className="sticky top-0 z-40 w-full glass border-b-0 border-zinc-800/50">
      <div className="max-w-5xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        
        {/* Logo */}
        <Link href={hasVerifiedCompany ? "/dashboard" : "/"} className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center shadow-lg shadow-brand/20 group-hover:scale-105 transition-transform">
            <HardHat size={20} className="text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-zinc-50">JobBinder</span>
        </Link>

        <div className="flex items-center gap-6">
          {hasVerifiedCompany && <NavLinks showOrganization={canManageOrganization} />}
          {hasVerifiedCompany && <SyncStatusIndicator />}
          
          {user ? (
            <AccountMenu
              displayName={user.name ?? user.email ?? "User"}
              email={user.email ?? null}
              hasCompany={hasVerifiedCompany}
              canManageOrganization={canManageOrganization}
              accounts={accounts}
              signOutAction={handleSignOut}
            />
          ) : (
            <Link href="/sign-in" className="text-sm font-medium text-zinc-400 hover:text-brand">
              Sign in
            </Link>
          )}
        </div>

      </div>
    </nav>
  );
}
