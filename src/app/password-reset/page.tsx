import Link from "next/link";
import { KeyRound } from "lucide-react";
import { PasswordResetForm } from "@/components/auth/PasswordResetForm";
import { Card, CardContent } from "@/components/ui/Card";

type PasswordResetSearchParams = Promise<{
  email?: string | string[];
  token?: string | string[];
}>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PasswordResetPage({
  searchParams,
}: {
  searchParams: PasswordResetSearchParams;
}) {
  const params = await searchParams;
  const email = firstValue(params.email) ?? "";
  const token = firstValue(params.token) ?? "";
  const hasLinkData = Boolean(email && token);

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-brand/15 border border-brand/30 flex items-center justify-center">
              <KeyRound size={24} className="text-brand-light" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Choose a password</h1>
              <p className="text-sm text-zinc-400">Use the one-time link from your email.</p>
            </div>
          </div>

          {hasLinkData ? (
            <PasswordResetForm email={email} token={token} />
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">
                This password setup link is missing information.
              </p>
              <Link href="/password-reset/request" className="text-sm text-brand-light hover:text-brand">
                Request a new setup link
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
