"use client";

import { useActionState } from "react";
import { resetPassword, type AuthFormState } from "@/app/auth-actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const initialState: AuthFormState = {};

export function PasswordResetForm({
  email,
  token,
}: {
  email: string;
  token: string;
}) {
  const [state, action, pending] = useActionState(resetPassword, initialState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="block text-sm font-medium text-zinc-400 mb-1">
          New password
        </label>
        <Input name="password" type="password" required autoComplete="new-password" />
        {state.fieldErrors?.password && (
          <p className="mt-1 text-xs text-red-300">{state.fieldErrors.password}</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-400 mb-1">
          Confirm password
        </label>
        <Input name="confirmPassword" type="password" required autoComplete="new-password" />
        {state.fieldErrors?.confirmPassword && (
          <p className="mt-1 text-xs text-red-300">{state.fieldErrors.confirmPassword}</p>
        )}
      </div>
      {state.message && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {state.message}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving..." : "Set password"}
      </Button>
    </form>
  );
}
