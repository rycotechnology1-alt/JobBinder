import Link from "next/link";
import { UserPlus } from "lucide-react";
import prisma from "@/lib/prisma";
import { InviteAcceptForm } from "@/components/auth/InviteAcceptForm";
import { Card, CardContent } from "@/components/ui/Card";

type InviteAcceptSearchParams = Promise<{
  inviteId?: string | string[];
  token?: string | string[];
}>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function InviteAcceptPage({
  searchParams,
}: {
  searchParams: InviteAcceptSearchParams;
}) {
  const params = await searchParams;
  const inviteId = firstValue(params.inviteId) ?? "";
  const token = firstValue(params.token) ?? "";
  const invite = inviteId
    ? await prisma.invite.findUnique({
        where: { id: inviteId },
        include: { company: { select: { name: true } } },
      })
    : null;
  const canAccept =
    Boolean(token) &&
    invite &&
    invite.status === "PENDING" &&
    !invite.canceledAt &&
    !invite.acceptedAt;

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
              <UserPlus size={24} className="text-emerald-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Accept invite</h1>
              <p className="text-sm text-zinc-400">
                Create your password to join the account workspace.
              </p>
            </div>
          </div>

          {canAccept ? (
            <InviteAcceptForm
              inviteId={invite.id}
              token={token}
              email={invite.email}
              companyName={invite.company.name}
            />
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">
                This invite link is invalid, expired, or already accepted.
              </p>
              <Link href="/sign-in" className="text-sm text-brand-light hover:text-brand">
                Back to sign in
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
