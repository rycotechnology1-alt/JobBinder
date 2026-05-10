"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function InviteUserForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          role: formData.get("role"),
        }),
      });
      const body = await res.json();

      if (!res.ok) {
        setMessage(body.error ?? "Unable to send invite.");
        return;
      }

      form.reset();
      setMessage("Invite email sent.");
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage("Unable to send invite.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-[1fr_150px_auto] gap-3">
      <Input name="email" type="email" required placeholder="crew@company.com" />
      <select
        name="role"
        defaultValue="MEMBER"
        className="h-11 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
      >
        <option value="MEMBER">Member</option>
        <option value="ADMIN">Admin</option>
      </select>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Invite"}
      </Button>
      {message && (
        <p className="md:col-span-3 text-sm text-zinc-400">{message}</p>
      )}
    </form>
  );
}
