import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { getCurrentAppUser } from "@/lib/current-user";
import { createCompany } from "./actions";

export default async function OnboardingPage() {
  const user = await getCurrentAppUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (user.companyId) {
    redirect("/");
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardContent className="p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
              <Building2 size={24} className="text-emerald-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Create your owner account</h1>
              <p className="text-sm text-zinc-400">
                This sets up your global account, default workspace, and owner access.
              </p>
            </div>
          </div>

          <form action={createCompany} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Account name
              </label>
              <Input
                name="companyName"
                required
                placeholder="e.g. Acme Construction"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full">
              Create owner account
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
