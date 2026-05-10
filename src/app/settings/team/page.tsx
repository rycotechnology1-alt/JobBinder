import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { InviteUserForm } from "@/components/InviteUserForm";
import { requirePageCompanyUser } from "@/lib/current-user";

export default async function TeamSettingsPage() {
  const user = await requirePageCompanyUser();
  const [users, invites] = await Promise.all([
    prisma.user.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    }),
    prisma.invite.findMany({
      where: {
        companyId: user.companyId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto pt-4">
      <div className="glass rounded-2xl p-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">Team Settings</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Manage the small crew that can access {user.company.name}.
        </p>
      </div>

      {user.role === "ADMIN" && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Invite crew member</h2>
              <p className="text-sm text-zinc-400">
                Free companies can have up to 5 users.
              </p>
            </div>
            <InviteUserForm />
          </CardContent>
        </Card>
      )}

      {user.role !== "ADMIN" && (
        <Card>
          <CardContent className="p-6 text-sm text-zinc-400">
            Only admins can invite crew members.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="p-6 border-b border-zinc-800">
            <h2 className="text-lg font-semibold text-white">Current users</h2>
          </div>
          <div className="divide-y divide-zinc-800">
            {users.map((crewUser) => (
              <div key={crewUser.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-zinc-200">
                    {crewUser.name ?? crewUser.email ?? "Unnamed user"}
                  </p>
                  <p className="text-xs text-zinc-500">{crewUser.email}</p>
                </div>
                <Badge variant={crewUser.role === "ADMIN" ? "brand" : "default"}>
                  {crewUser.role}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {invites.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="p-6 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white">Pending invites</h2>
            </div>
            <div className="divide-y divide-zinc-800">
              {invites.map((invite) => (
                <div key={invite.id} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-zinc-200">{invite.email}</p>
                    <p className="text-xs text-zinc-500">
                      Expires {invite.expiresAt.toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="default">{invite.role}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
