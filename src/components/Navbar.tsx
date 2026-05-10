import Link from "next/link";
import { HardHat } from "lucide-react";
import { signOut } from "@/auth";
import { getCurrentAppUser } from "@/lib/current-user";
import { NavLinks } from "@/components/NavLinks";

export async function Navbar() {
  const user = await getCurrentAppUser();

  async function handleSignOut() {
    "use server";

    await signOut({ redirectTo: "/sign-in" });
  }

  return (
    <nav className="sticky top-0 z-40 w-full glass border-b-0 border-zinc-800/50">
      <div className="max-w-5xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center shadow-lg shadow-brand/20 group-hover:scale-105 transition-transform">
            <HardHat size={20} className="text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-zinc-50">JobBinder</span>
        </Link>

        <div className="flex items-center gap-6">
          {user?.companyId && <NavLinks />}
          
          {user ? (
            <form action={handleSignOut}>
              <button
                type="submit"
                className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-300 hover:border-brand/60 transition-colors"
                title="Sign out"
              >
                {(user.name ?? user.email ?? "U").charAt(0).toUpperCase()}
              </button>
            </form>
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
