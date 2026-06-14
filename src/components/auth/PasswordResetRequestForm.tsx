"use client";

import { useActionState } from "react";
import { requestPasswordReset, type AuthFormState } from "@/app/auth-actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const initialState: AuthFormState = {};

export function PasswordResetRequestForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-400 mb-1">
          Email address
        </label>
        <Input name="email" type="email" required placeholder="you@company.com" autoComplete="email" />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending..." : "Send setup link"}
      </Button>
      {state.message && (
        <p className={state.ok ? "text-sm text-emerald-300" : "text-sm text-red-300"}>
          {state.message}
        </p>
      )}
    </form>
  );
}
