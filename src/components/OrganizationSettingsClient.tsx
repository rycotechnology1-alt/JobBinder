"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, FolderKanban, Grid3X3, Send, Shield, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import type { getOrganizationSnapshot } from "@/lib/organization";

type Snapshot = Awaited<ReturnType<typeof getOrganizationSnapshot>>;
type TabId = "overview" | "org-units" | "workspaces" | "crews" | "members" | "invites" | "access";

const tabs: Array<{ id: TabId; label: string; icon: typeof Building2 }> = [
  { id: "overview", label: "Overview", icon: Grid3X3 },
  { id: "org-units", label: "Companies/Divisions", icon: Building2 },
  { id: "workspaces", label: "Workspaces", icon: FolderKanban },
  { id: "crews", label: "Crews", icon: Users },
  { id: "members", label: "Members", icon: Shield },
  { id: "invites", label: "Invites", icon: Send },
  { id: "access", label: "Access Matrix", icon: Grid3X3 },
];

function formValues(form: HTMLFormElement) {
  const data = new FormData(form);
  return Object.fromEntries(data.entries());
}

function selectedValues(form: HTMLFormElement, name: string) {
  return new FormData(form).getAll(name).filter((value): value is string => typeof value === "string" && value.length > 0);
}

function memberLabel(member: { user: { name: string | null; email: string | null } }) {
  return member.user.name ?? member.user.email ?? "Unnamed member";
}

function principalLabel(snapshot: Snapshot, principalType: string, principalId: string) {
  if (principalType === "MEMBER") {
    const member = snapshot.members.find((candidate) => candidate.id === principalId);
    return member ? memberLabel(member) : "Unknown member";
  }

  if (principalType === "CREW") {
    return snapshot.crews.find((crew) => crew.id === principalId)?.name ?? "Unknown crew";
  }

  return snapshot.orgUnits.find((orgUnit) => orgUnit.id === principalId)?.name ?? "Unknown division";
}

function targetLabel(snapshot: Snapshot, targetType: "WORKSPACE" | "JOB", targetId: string) {
  if (targetType === "WORKSPACE") {
    return snapshot.workspaces.find((workspace) => workspace.id === targetId)?.name ?? "Unknown workspace";
  }

  return snapshot.jobs.find((job) => job.id === targetId)?.title ?? "Unknown job";
}

export function OrganizationSettingsClient({ snapshot }: { snapshot: Snapshot }) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<"WORKSPACE" | "JOB">("WORKSPACE");
  const [principalType, setPrincipalType] = useState<"MEMBER" | "CREW" | "ORG_UNIT">("MEMBER");
  const router = useRouter();

  const activeMembers = snapshot.members.filter((member) => member.status === "ACTIVE");
  const admins = snapshot.members.filter((member) => member.status === "ACTIVE" && (member.role === "OWNER" || member.role === "ADMIN"));
  const assignableMembers = snapshot.members.filter((member) => member.status !== "REMOVED");

  const principalOptions = useMemo(() => {
    if (principalType === "MEMBER") {
      return assignableMembers.map((member) => ({ id: member.id, name: memberLabel(member) }));
    }
    if (principalType === "CREW") {
      return snapshot.crews.map((crew) => ({ id: crew.id, name: crew.name }));
    }
    return snapshot.orgUnits.map((orgUnit) => ({ id: orgUnit.id, name: orgUnit.name }));
  }, [assignableMembers, principalType, snapshot.crews, snapshot.orgUnits]);

  async function submitJson(path: string, body: object, action: string, method = "POST") {
    setPendingAction(action);
    setMessage(null);
    try {
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(payload.error ?? "Unable to save changes.");
        return false;
      }
      setMessage("Changes saved.");
      router.refresh();
      return true;
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteJson(path: string, action: string) {
    setPendingAction(action);
    setMessage(null);
    try {
      const res = await fetch(path, { method: "DELETE" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(payload.error ?? "Unable to save changes.");
        return;
      }
      setMessage("Changes saved.");
      router.refresh();
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="glass rounded-2xl p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Organization</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {snapshot.company.name} global account
            </p>
          </div>
          <Badge variant={snapshot.role === "OWNER" ? "brand" : "default"}>{snapshot.role}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors",
                isActive
                  ? "border-brand/50 bg-brand/15 text-brand-light"
                  : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100",
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {message && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-4 py-3 text-sm text-zinc-300">
          {message}
        </div>
      )}

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            ["Owners/Admins", admins.length],
            ["Members", activeMembers.length],
            ["Workspaces", snapshot.workspaces.length],
            ["Crews", snapshot.crews.length],
          ].map(([label, value]) => (
            <Card key={label}>
              <CardContent className="p-5">
                <p className="text-sm text-zinc-500">{label}</p>
                <p className="mt-2 text-3xl font-bold text-white">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === "org-units" && (
        <Card>
          <CardContent className="space-y-5 p-6">
            <form
              className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px_1fr_auto]"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const ok = await submitJson("/api/organization/org-units", formValues(form), "org-unit");
                if (ok) form.reset();
              }}
            >
              <Input name="name" required placeholder="Division or internal company name" />
              <select name="kind" defaultValue="DIVISION" className="h-11 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-50">
                <option value="DIVISION">Division</option>
                <option value="COMPANY">Company</option>
              </select>
              <select name="parentOrgUnitId" defaultValue="" className="h-11 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-50">
                <option value="">No parent</option>
                {snapshot.orgUnits.map((orgUnit) => (
                  <option key={orgUnit.id} value={orgUnit.id}>{orgUnit.name}</option>
                ))}
              </select>
              <Button type="submit" disabled={pendingAction === "org-unit"}>Create</Button>
            </form>
            <div className="divide-y divide-zinc-800">
              {snapshot.orgUnits.map((orgUnit) => (
                <div key={orgUnit.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium text-zinc-100">{orgUnit.name}</p>
                    <p className="text-xs text-zinc-500">{orgUnit.kind}</p>
                  </div>
                  <Badge variant={orgUnit.kind === "COMPANY" ? "brand" : "default"}>{orgUnit.kind}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "workspaces" && (
        <Card>
          <CardContent className="space-y-5 p-6">
            <form
              className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const ok = await submitJson("/api/organization/workspaces", formValues(form), "workspace");
                if (ok) form.reset();
              }}
            >
              <Input name="name" required placeholder="Workspace name" />
              <select name="orgUnitId" required defaultValue="" className="h-11 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-50">
                <option value="" disabled>Select company or division</option>
                {snapshot.orgUnits.map((orgUnit) => (
                  <option key={orgUnit.id} value={orgUnit.id}>{orgUnit.name}</option>
                ))}
              </select>
              <Button type="submit" disabled={pendingAction === "workspace"}>Create</Button>
            </form>
            <div className="divide-y divide-zinc-800">
              {snapshot.workspaces.map((workspace) => (
                <div key={workspace.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium text-zinc-100">{workspace.name}</p>
                    <p className="text-xs text-zinc-500">{workspace.orgUnit.name}</p>
                  </div>
                  <Badge variant="default">{snapshot.jobs.filter((job) => job.workspaceId === workspace.id).length} jobs</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "crews" && (
        <Card>
          <CardContent className="space-y-5 p-6">
            <form
              className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const ok = await submitJson("/api/organization/crews", formValues(form), "crew");
                if (ok) form.reset();
              }}
            >
              <Input name="name" required placeholder="Crew name" />
              <Input name="typeLabel" required placeholder="Crew type" />
              <select name="orgUnitId" defaultValue="" className="h-11 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-50">
                <option value="">No division</option>
                {snapshot.orgUnits.map((orgUnit) => (
                  <option key={orgUnit.id} value={orgUnit.id}>{orgUnit.name}</option>
                ))}
              </select>
              <Button type="submit" disabled={pendingAction === "crew"}>Create</Button>
            </form>
            <div className="space-y-4">
              {snapshot.crews.map((crew) => (
                <div key={crew.id} className="rounded-lg border border-zinc-800 p-4">
                  <form
                    className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      await submitJson(`/api/organization/crews/${crew.id}`, formValues(event.currentTarget), `crew-${crew.id}`, "PATCH");
                    }}
                  >
                    <Input name="name" defaultValue={crew.name} />
                    <Input name="typeLabel" defaultValue={crew.typeLabel} />
                    <Button type="submit" variant="secondary" disabled={pendingAction === `crew-${crew.id}`}>Update</Button>
                  </form>
                  <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap gap-2">
                      {crew.memberships.map((membership) => (
                        <Badge key={membership.companyMembershipId} variant="default">
                          {memberLabel(membership.companyMembership)}
                        </Badge>
                      ))}
                    </div>
                    <form
                      className="flex gap-2"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        const form = event.currentTarget;
                        await submitJson(`/api/organization/crews/${crew.id}/members`, formValues(form), `crew-member-${crew.id}`);
                      }}
                    >
                      <select name="membershipId" required defaultValue="" className="h-9 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-sm text-zinc-50">
                        <option value="" disabled>Select member</option>
                        {assignableMembers.map((member) => (
                          <option key={member.id} value={member.id}>{memberLabel(member)}</option>
                        ))}
                      </select>
                      <select name="action" defaultValue="add" className="h-9 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-sm text-zinc-50">
                        <option value="add">Add</option>
                        <option value="remove">Remove</option>
                      </select>
                      <Button type="submit" size="sm" variant="secondary">Save</Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "members" && (
        <Card>
          <CardContent className="space-y-5 p-6">
            <form
              className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_140px_1fr_1fr_1fr_auto]"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const values = formValues(form);
                const ok = await submitJson("/api/organization/invites", {
                  email: values.email,
                  role: values.role,
                  orgUnitIds: selectedValues(form, "orgUnitIds"),
                  crewIds: selectedValues(form, "crewIds"),
                  workspaceIds: selectedValues(form, "workspaceIds"),
                }, "invite");
                if (ok) form.reset();
              }}
            >
              <Input name="email" type="email" required placeholder="employee@company.com" />
              <select name="role" defaultValue="MEMBER" className="h-11 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-50">
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
              <select name="orgUnitIds" multiple className="min-h-11 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-50">
                {snapshot.orgUnits.map((orgUnit) => (
                  <option key={orgUnit.id} value={orgUnit.id}>{orgUnit.name}</option>
                ))}
              </select>
              <select name="crewIds" multiple className="min-h-11 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-50">
                {snapshot.crews.map((crew) => (
                  <option key={crew.id} value={crew.id}>{crew.name}</option>
                ))}
              </select>
              <select name="workspaceIds" multiple className="min-h-11 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-50">
                {snapshot.workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
                ))}
              </select>
              <Button type="submit" disabled={pendingAction === "invite"}>Invite</Button>
            </form>

            <div className="divide-y divide-zinc-800">
              {snapshot.members.map((member) => (
                <div key={member.id} className="grid grid-cols-1 gap-3 py-4 lg:grid-cols-[1fr_120px_160px_auto] lg:items-center">
                  <div>
                    <p className="font-medium text-zinc-100">{memberLabel(member)}</p>
                    <p className="text-xs text-zinc-500">{member.user.email}</p>
                  </div>
                  <Badge variant={member.status === "ACTIVE" ? "success" : member.status === "DEACTIVATED" ? "warning" : "danger"}>
                    {member.status}
                  </Badge>
                  <select
                    defaultValue={member.role}
                    disabled={member.role === "OWNER" || (member.role === "ADMIN" && snapshot.role !== "OWNER")}
                    className="h-10 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-50 disabled:opacity-50"
                    onChange={(event) => {
                      void submitJson(`/api/organization/members/${member.id}`, { role: event.currentTarget.value }, `role-${member.id}`, "PATCH");
                    }}
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                    {member.role === "OWNER" && <option value="OWNER">Owner</option>}
                  </select>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={member.role === "OWNER" || (member.role === "ADMIN" && snapshot.role !== "OWNER")}
                      onClick={() => void submitJson(`/api/organization/members/${member.id}`, { status: "ACTIVE" }, `activate-${member.id}`, "PATCH")}
                    >
                      Activate
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      disabled={member.role === "OWNER" || (member.role === "ADMIN" && snapshot.role !== "OWNER")}
                      onClick={() => void submitJson(`/api/organization/members/${member.id}`, { status: "DEACTIVATED" }, `deactivate-${member.id}`, "PATCH")}
                    >
                      Deactivate
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      disabled={member.role === "OWNER" || (member.role === "ADMIN" && snapshot.role !== "OWNER")}
                      onClick={() => void submitJson(`/api/organization/members/${member.id}`, { status: "REMOVED" }, `remove-${member.id}`, "PATCH")}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "invites" && (
        <Card>
          <CardContent className="divide-y divide-zinc-800 p-0">
            {snapshot.invites.length === 0 && (
              <div className="p-6 text-sm text-zinc-400">No pending invites.</div>
            )}
            {snapshot.invites.map((invite) => (
              <div key={invite.id} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="font-medium text-zinc-100">{invite.email}</p>
                  <p className="text-xs text-zinc-500">
                    {invite.role} - expires {invite.expiresAt.toLocaleDateString()}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {[
                      ...invite.orgUnitAssignments.map((assignment) => principalLabel(snapshot, "ORG_UNIT", assignment.orgUnitId)),
                      ...invite.crewAssignments.map((assignment) => principalLabel(snapshot, "CREW", assignment.crewId)),
                      ...invite.workspaceAssignments.map((assignment) => targetLabel(snapshot, "WORKSPACE", assignment.workspaceId)),
                    ].join(", ") || "No assignments"}
                  </p>
                </div>
                <div className="flex gap-2 md:justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void submitJson(`/api/organization/invites/${invite.id}/resend`, {}, `resend-${invite.id}`)}
                  >
                    Resend
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => void deleteJson(`/api/organization/invites/${invite.id}`, `cancel-${invite.id}`)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {activeTab === "access" && (
        <Card>
          <CardContent className="space-y-5 p-6">
            <form
              className="grid grid-cols-1 gap-3 lg:grid-cols-[150px_1fr_150px_1fr_auto]"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const ok = await submitJson("/api/organization/access-grants", formValues(form), "access-grant");
                if (ok) form.reset();
              }}
            >
              <select name="targetType" value={targetType} onChange={(event) => setTargetType(event.currentTarget.value as "WORKSPACE" | "JOB")} className="h-11 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-50">
                <option value="WORKSPACE">Workspace</option>
                <option value="JOB">Job</option>
              </select>
              <select name="targetId" required defaultValue="" className="h-11 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-50">
                <option value="" disabled>Select target</option>
                {targetType === "WORKSPACE"
                  ? snapshot.workspaces.map((target) => (
                    <option key={target.id} value={target.id}>{target.name}</option>
                  ))
                  : snapshot.jobs.map((target) => (
                    <option key={target.id} value={target.id}>{target.title}</option>
                  ))}
              </select>
              <select name="principalType" value={principalType} onChange={(event) => setPrincipalType(event.currentTarget.value as "MEMBER" | "CREW" | "ORG_UNIT")} className="h-11 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-50">
                <option value="MEMBER">Member</option>
                <option value="CREW">Crew</option>
                <option value="ORG_UNIT">Division</option>
              </select>
              <select name="principalId" required defaultValue="" className="h-11 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-50">
                <option value="" disabled>Select access target</option>
                {principalOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
              <Button type="submit" disabled={pendingAction === "access-grant"}>Grant</Button>
            </form>

            <div className="divide-y divide-zinc-800">
              {[...snapshot.workspaceAccessGrants.map((grant) => ({ ...grant, targetType: "WORKSPACE" as const, targetId: grant.workspaceId })),
                ...snapshot.jobAccessGrants.map((grant) => ({ ...grant, targetType: "JOB" as const, targetId: grant.jobId }))].map((grant) => (
                <div key={grant.id} className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-zinc-100">
                      {principalLabel(snapshot, grant.principalType, grant.principalId)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {grant.principalType} access to {targetLabel(snapshot, grant.targetType, grant.targetId)}
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="danger" onClick={() => void deleteJson(`/api/organization/access-grants/${grant.id}`, `grant-${grant.id}`)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
