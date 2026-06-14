"use client";

import { useActionState } from "react";
import { acceptInvite, type AuthFormState } from "@/app/auth-actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const initialState: AuthFormState = {};

export function InviteAcceptForm({
  inviteId,
  token,
  email,
  companyName,
}: {
  inviteId: string;
  token: string;
  email: string;
  companyName: string;
}) {
  const [state, action, pending] = useActionState(acceptInvite, initialState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="inviteId" value={inviteId} />
      <input type="hidden" name="token" value={token} />
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-300">
        Joining <span className="text-zinc-100">{companyName}</span> as{" "}
        <span className="text-zinc-100">{email}</span>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-400 mb-1">
          Your name
        </label>
        <Input name="name" required placeholder="Crew Member" autoComplete="name" />
        {state.fieldErrors?.name && (
          <p className="mt-1 text-xs text-red-300">{state.fieldErrors.name}</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-400 mb-1">
          Password
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
        {pending ? "Joining..." : "Join company"}
      </Button>
    </form>
  );
}
