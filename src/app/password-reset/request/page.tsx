import Link from "next/link";
import { KeyRound } from "lucide-react";
import { PasswordResetRequestForm } from "@/components/auth/PasswordResetRequestForm";
import { Card, CardContent } from "@/components/ui/Card";

export default function PasswordResetRequestPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-brand/15 border border-brand/30 flex items-center justify-center">
              <KeyRound size={24} className="text-brand-light" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Set your password</h1>
              <p className="text-sm text-zinc-400">
                We&apos;ll email a one-time setup link if the account exists.
              </p>
            </div>
          </div>

          <PasswordResetRequestForm />

          <p className="text-center text-sm text-zinc-400">
            <Link href="/sign-in" className="text-brand-light hover:text-brand">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
