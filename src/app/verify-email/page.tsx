import { redirect } from "next/navigation";
import { MailCheck } from "lucide-react";
import { auth, signOut } from "@/auth";
import { VerifyEmailPanel } from "@/components/auth/VerifyEmailPanel";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { getPostSignInPath } from "@/lib/auth-rules";

export default async function VerifyEmailPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in");
  }

  if (session.user.emailVerified) {
    redirect(getPostSignInPath(session.user));
  }

  async function handleSignOut() {
    "use server";

    await signOut({ redirectTo: "/sign-in" });
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center">
            <MailCheck size={26} className="text-brand-light" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Verify your email</h1>
            <p className="text-sm text-zinc-400 mt-2">
              Verify your email before using company job binders, inviting employees, or changing job data.
            </p>
          </div>
          <VerifyEmailPanel email={session.user.email ?? null} />
          <form action={handleSignOut}>
            <Button type="submit" variant="ghost" className="w-full">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
