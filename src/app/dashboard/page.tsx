import prisma from "@/lib/prisma";
import { HardHat } from "lucide-react";
import { CreateJobDialog } from "@/components/CreateJobDialog";
import { DashboardFilters } from "@/components/DashboardFilters";
import { DashboardJobCard } from "@/components/DashboardJobCard";
import { requirePageCompanyUser } from "@/lib/current-user";
import { buildAccessibleJobWhere, isAccountManagerRole } from "@/lib/account-access";
import {
  getDashboardJobSearchWhere,
  getDashboardStatusFilterWhere,
  normalizeDashboardSearch,
  normalizeDashboardStatusFilter,
} from "@/lib/job-management";

type DashboardSearchParams = Promise<{
  search?: string | string[];
  status?: string | string[];
}>;

function firstSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function getCompanyAndJobs({
  search,
  status,
}: {
  search: string;
  status: string;
}) {
  const user = await requirePageCompanyUser();
  const [jobs, workspaces] = await Promise.all([
    prisma.job.findMany({
      where: {
        ...buildAccessibleJobWhere({
          companyId: user.companyId,
          membershipId: user.membershipId,
          role: user.role,
          crewIds: user.crewIds,
          orgUnitIds: user.orgUnitIds,
        }),
        ...getDashboardStatusFilterWhere(status),
        ...getDashboardJobSearchWhere(search),
      },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.workspace.findMany({
      where: { companyId: user.companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return { company: user.company, jobs, workspaces, canManageJobs: isAccountManagerRole(user.role) };
}

export default async function Dashboard({ searchParams }: { searchParams: DashboardSearchParams }) {
  const params = await searchParams;
  const currentSearch = normalizeDashboardSearch(firstSearchParamValue(params.search));
  const currentStatus = normalizeDashboardStatusFilter(firstSearchParamValue(params.status));
  const { company, jobs, workspaces, canManageJobs } = await getCompanyAndJobs({
    search: currentSearch,
    status: currentStatus,
  });

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto pt-4">
      <div className="glass rounded-2xl p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 shadow-inner">
            <HardHat size={24} className="text-brand-light" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide text-white">{company.name}</h1>
            <p className="text-xs text-zinc-400 font-medium tracking-widest uppercase mt-1">Field Management</p>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <DashboardFilters currentSearch={currentSearch} currentStatus={currentStatus} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {canManageJobs && <CreateJobDialog workspaces={workspaces} />}
        {jobs.map((job) => <DashboardJobCard key={job.id} job={job} />)}
      </div>
    </div>
  );
}
