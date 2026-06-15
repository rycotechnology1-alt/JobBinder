import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = !process.argv.includes("--apply");

function legacyMembershipRole(user, ownerUserId) {
  if (user.id === ownerUserId) return "OWNER";
  return user.role === "ADMIN" ? "ADMIN" : "MEMBER";
}

async function findOrCreateDefaultOrgUnit(tx, company, counts) {
  const existing = await tx.orgUnit.findFirst({
    where: { companyId: company.id, kind: "COMPANY" },
    orderBy: { createdAt: "asc" },
  });

  if (existing) return existing;
  counts.orgUnits += 1;
  if (dryRun) return { id: `dry-org-${company.id}`, companyId: company.id, name: company.name, kind: "COMPANY" };

  return tx.orgUnit.create({
    data: {
      companyId: company.id,
      name: company.name,
      kind: "COMPANY",
    },
  });
}

async function findOrCreateDefaultWorkspace(tx, company, orgUnit, counts) {
  const existing = await tx.workspace.findFirst({
    where: { companyId: company.id, name: "Main Workspace" },
    orderBy: { createdAt: "asc" },
  });

  if (existing) return existing;
  counts.workspaces += 1;
  if (dryRun) return { id: `dry-workspace-${company.id}`, companyId: company.id, orgUnitId: orgUnit.id, name: "Main Workspace" };

  return tx.workspace.create({
    data: {
      companyId: company.id,
      orgUnitId: orgUnit.id,
      name: "Main Workspace",
    },
  });
}

async function backfillCompany(company, counts) {
  await prisma.$transaction(async (tx) => {
    const orgUnit = await findOrCreateDefaultOrgUnit(tx, company, counts);
    const workspace = await findOrCreateDefaultWorkspace(tx, company, orgUnit, counts);

    const unassignedJobs = await tx.job.count({
      where: { companyId: company.id, workspaceId: null },
    });
    counts.jobsAssigned += unassignedJobs;
    if (!dryRun && unassignedJobs > 0) {
      await tx.job.updateMany({
        where: { companyId: company.id, workspaceId: null },
        data: { workspaceId: workspace.id },
      });
    }

    const ownerUser = company.users.find((user) => user.role === "ADMIN") ?? company.users[0] ?? null;

    for (const user of company.users) {
      const role = legacyMembershipRole(user, ownerUser?.id);
      const existingMembership = await tx.companyMembership.findUnique({
        where: {
          companyId_userId: {
            companyId: company.id,
            userId: user.id,
          },
        },
      });

      const membership = existingMembership ?? (dryRun
        ? { id: `dry-membership-${company.id}-${user.id}`, role, status: "ACTIVE" }
        : await tx.companyMembership.create({
          data: {
            companyId: company.id,
            userId: user.id,
            role,
            status: "ACTIVE",
          },
        }));

      if (!existingMembership) {
        counts.memberships += 1;
      }

      if (role === "OWNER" && user.role !== "OWNER") {
        counts.legacyOwners += 1;
        if (!dryRun) {
          await tx.user.update({
            where: { id: user.id },
            data: { role: "OWNER" },
          });
        }
      }

      if (role === "MEMBER") {
        const existingGrant = await tx.workspaceAccessGrant.findFirst({
          where: {
            workspaceId: workspace.id,
            principalType: "MEMBER",
            principalId: membership.id,
          },
        });

        if (!existingGrant) {
          counts.workspaceGrants += 1;
          if (!dryRun) {
            await tx.workspaceAccessGrant.create({
              data: {
                companyId: company.id,
                workspaceId: workspace.id,
                principalType: "MEMBER",
                principalId: membership.id,
              },
            });
          }
        }
      }
    }

    const pendingInvites = await tx.invite.count({
      where: {
        companyId: company.id,
        acceptedAt: null,
        canceledAt: null,
        status: { not: "PENDING" },
      },
    });
    counts.invitesMarkedPending += pendingInvites;
    if (!dryRun && pendingInvites > 0) {
      await tx.invite.updateMany({
        where: {
          companyId: company.id,
          acceptedAt: null,
          canceledAt: null,
          status: { not: "PENDING" },
        },
        data: { status: "PENDING" },
      });
    }
  });
}

async function main() {
  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    include: {
      users: {
        orderBy: { id: "asc" },
        select: { id: true, role: true },
      },
    },
  });

  const counts = {
    companies: companies.length,
    orgUnits: 0,
    workspaces: 0,
    memberships: 0,
    legacyOwners: 0,
    jobsAssigned: 0,
    workspaceGrants: 0,
    invitesMarkedPending: 0,
  };

  for (const company of companies) {
    await backfillCompany(company, counts);
  }

  console.log(`${dryRun ? "Dry run" : "Applied"} organization backfill`);
  console.table(counts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
