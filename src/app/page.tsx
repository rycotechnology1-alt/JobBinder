import prisma from "@/lib/prisma";
import { Search, HardHat } from "lucide-react";
import { CreateJobDialog } from "@/components/CreateJobDialog";
import { DashboardJobCard } from "@/components/DashboardJobCard";
import { requirePageCompanyUser } from "@/lib/current-user";

async function getCompanyAndJobs() {
  const user = await requirePageCompanyUser();
  const jobs = await prisma.job.findMany({
    where: { companyId: user.companyId },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });

  return { company: user.company, jobs };
}

export default async function Dashboard() {
  const { company, jobs } = await getCompanyAndJobs();

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
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input
              type="text"
              placeholder="Search jobs..."
              className="w-full h-10 pl-10 pr-4 bg-black/40 border border-white/10 rounded-full text-sm focus:outline-none focus:border-brand/50 transition-colors text-zinc-200 placeholder:text-zinc-500"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <CreateJobDialog />
        {jobs.map((job) => <DashboardJobCard key={job.id} job={job} />)}
      </div>
    </div>
  );
}
