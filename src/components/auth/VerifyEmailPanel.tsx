"use client";

import { useActionState } from "react";
import {
  resendVerificationEmailAction,
  type AuthFormState,
} from "@/app/auth-actions";
import { Button } from "@/components/ui/Button";

const initialState: AuthFormState = {};

export function VerifyEmailPanel({ email }: { email: string | null }) {
  const [state, action, pending] = useActionState(
    resendVerificationEmailAction,
    initialState,
  );

  return (
    <form action={action} className="space-y-4">
      {email && (
        <p className="text-sm text-zinc-400">
          We sent a verification link to <span className="text-zinc-100">{email}</span>.
        </p>
      )}
      <Button type="submit" variant="secondary" className="w-full" disabled={pending}>
        {pending ? "Sending..." : "Resend verification email"}
      </Button>
      {state.message && (
        <p className={state.ok ? "text-sm text-emerald-300" : "text-sm text-red-300"}>
          {state.message}
        </p>
      )}
    </form>
  );
}
