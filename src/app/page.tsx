import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, ClipboardCheck, HardHat, Users } from "lucide-react";
import { SignupForm } from "@/components/auth/SignupForm";
import { Card, CardContent } from "@/components/ui/Card";
import { getCurrentAppUser } from "@/lib/current-user";
import { getPostSignInPath } from "@/lib/auth-rules";

export default async function LandingPage() {
  const user = await getCurrentAppUser();

  if (user?.companyId && user.emailVerified) {
    redirect(getPostSignInPath(user));
  }

  if (user?.companyId && !user.emailVerified) {
    redirect("/verify-email");
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-8 items-start max-w-6xl mx-auto py-6 md:py-12">
      <section className="space-y-8">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-sm text-brand-light">
            <HardHat size={16} />
            Built for small construction crews
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
              Create your JobBinder company profile
            </h1>
            <p className="text-lg text-zinc-300 max-w-2xl">
              Account creation sets up a shared company workspace. The person who creates it becomes the admin and can invite employees to work inside the company&apos;s job binders.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/sign-in"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-700 px-4 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
            >
              Sign in to an existing company
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <Building2 className="text-brand-light" size={22} />
            <h2 className="mt-3 font-semibold text-white">Company first</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Signup creates the company profile, not just an individual account.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <Users className="text-emerald-300" size={22} />
            <h2 className="mt-3 font-semibold text-white">Admin controlled</h2>
            <p className="mt-1 text-sm text-zinc-400">
              The admin invites employees and manages who can access the crew workspace.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <ClipboardCheck className="text-amber-300" size={22} />
            <h2 className="mt-3 font-semibold text-white">Shared binders</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Employees join the company to add notes, photos, files, and tasks to job binders.
            </p>
          </div>
        </div>
      </section>

      <Card>
        <CardContent className="p-6 md:p-8 space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-white">Create admin account</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Use this only if you are setting up a new company profile.
            </p>
          </div>
          <SignupForm />
        </CardContent>
      </Card>
    </div>
  );
}
