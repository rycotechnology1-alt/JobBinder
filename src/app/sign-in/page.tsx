import { redirect } from "next/navigation";
import { HardHat } from "lucide-react";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { getCurrentAppUser } from "@/lib/current-user";
import { getPostSignInPath } from "@/lib/auth-rules";

export default async function SignInPage() {
  const user = await getCurrentAppUser();

  if (user) {
    redirect(getPostSignInPath(user));
  }

  async function sendMagicLink(formData: FormData) {
    "use server";

    const email = formData.get("email");
    if (typeof email !== "string" || !email.trim()) return;

    await signIn("resend", {
      email,
      redirectTo: "/",
    });
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
              <p className="text-sm text-zinc-400">Get a secure email link for JobBinder.</p>
            </div>
          </div>

          <form action={sendMagicLink} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Email address
              </label>
              <Input
                name="email"
                type="email"
                required
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>
            <Button type="submit" className="w-full">
              Send magic link
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
