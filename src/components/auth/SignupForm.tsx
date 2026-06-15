"use client";

import { useActionState } from "react";
import { signupCompanyAdmin, type AuthFormState } from "@/app/auth-actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const initialState: AuthFormState = {};

export function SignupForm() {
  const [state, action, pending] = useActionState(signupCompanyAdmin, initialState);

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">
            Account name
          </label>
          <Input name="companyName" required placeholder="Acme Construction" />
          {state.fieldErrors?.companyName && (
            <p className="mt-1 text-xs text-red-300">{state.fieldErrors.companyName}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">
            Owner name
          </label>
          <Input name="adminName" required placeholder="Sam Builder" autoComplete="name" />
          {state.fieldErrors?.adminName && (
            <p className="mt-1 text-xs text-red-300">{state.fieldErrors.adminName}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">
          Owner email
        </label>
        <Input name="email" type="email" required placeholder="owner@company.com" autoComplete="email" />
        {state.fieldErrors?.email && (
          <p className="mt-1 text-xs text-red-300">{state.fieldErrors.email}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">
            Password
          </label>
          <Input name="password" type="password" required autoComplete="new-password" />
          {state.fieldErrors?.password && (
            <p className="mt-1 text-xs text-red-300">{state.fieldErrors.password}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">
            Confirm password
          </label>
          <Input name="confirmPassword" type="password" required autoComplete="new-password" />
          {state.fieldErrors?.confirmPassword && (
            <p className="mt-1 text-xs text-red-300">{state.fieldErrors.confirmPassword}</p>
          )}
        </div>
      </div>

      {state.message && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {state.message}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account..." : "Create owner account"}
      </Button>
    </form>
  );
}
