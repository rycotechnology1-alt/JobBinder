"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInWithPassword, type AuthFormState } from "@/app/auth-actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const initialState: AuthFormState = {};

export function SignInForm() {
  const [state, action, pending] = useActionState(signInWithPassword, initialState);

  return (
    <form action={action} className="space-y-4">
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
      <div>
        <label className="block text-sm font-medium text-zinc-400 mb-1">
          Password
        </label>
        <Input name="password" type="password" required autoComplete="current-password" />
      </div>

      {state.message && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {state.message}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </Button>

      <p className="text-center text-sm text-zinc-400">
        Need to set or reset your password?{" "}
        <Link href="/password-reset/request" className="text-brand-light hover:text-brand">
          Email me a setup link
        </Link>
      </p>
    </form>
  );
}
