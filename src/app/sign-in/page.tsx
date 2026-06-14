import { redirect } from "next/navigation";
import { HardHat } from "lucide-react";
import { SignInForm } from "@/components/auth/SignInForm";
import { Card, CardContent } from "@/components/ui/Card";
import { getCurrentAppUser } from "@/lib/current-user";
import { getPostSignInPath } from "@/lib/auth-rules";

export default async function SignInPage() {
  const user = await getCurrentAppUser();

  if (user) {
    redirect(getPostSignInPath(user));
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-brand flex items-center justify-center shadow-lg shadow-brand/20">
              <HardHat size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Sign in</h1>
              <p className="text-sm text-zinc-400">Use your JobBinder email and password.</p>
            </div>
          </div>

          <SignInForm />
        </CardContent>
      </Card>
    </div>
  );
}
