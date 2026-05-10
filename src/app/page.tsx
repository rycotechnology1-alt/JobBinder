import prisma from "@/lib/prisma";
import { Card, CardContent, CardFooter } from "@/components/ui/Card";
import { Search, MapPin, HardHat } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { CreateJobDialog } from "@/components/CreateJobDialog";
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
      
      {/* Top Stats Bar / Header Area */}
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

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Interactive Create New Job Component */}
        <CreateJobDialog />

        {/* Existing Jobs wrapped in Link */}
        {jobs.map((job) => {
          const isComplete = job.status === "COMPLETE";
          const isWarning = job.status === "DELAY" || job.status === "PUNCH_LIST";
          
          // Determine status color based on job status
          const statusColor = isComplete ? "text-success" : isWarning ? "text-warning" : "text-brand-light";
          const barColor = isComplete ? "bg-success" : isWarning ? "bg-warning" : "bg-brand";
          const shadowColor = isComplete ? "shadow-[0_0_15px_rgba(16,185,129,0.4)]" : isWarning ? "shadow-[0_0_15px_rgba(234,179,8,0.4)]" : "shadow-[0_0_15px_rgba(59,130,246,0.4)]";

          return (
            <Link href={`/jobs/${job.id}`} key={job.id} className="block group">
              <Card className="h-full min-h-[220px] justify-between relative overflow-hidden transition-all duration-300">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-brand-light transition-colors">
                    {job.title}
                  </h3>
                  
                  <div className="flex items-center gap-2 mb-6">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${statusColor}`}>
                      {job.status.replace("_", " ")}
                    </span>
                    {job.targetCompletionDate && (
                      <>
                        <span className="text-zinc-600">•</span>
                        <span className="text-[10px] uppercase tracking-widest text-zinc-500">
                          {format(new Date(job.targetCompletionDate), "MMM dd, yyyy")}
                        </span>
                      </>
                    )}
                  </div>
                  
                  {job.customerName && (
                    <p className="text-sm text-zinc-400 flex items-center gap-2">
                      <MapPin size={14} className="text-zinc-600" />
                      {job.customerName} {job.address ? `- ${job.address}` : ""}
                    </p>
                  )}
                </CardContent>

                {/* Progress Bar Footer matching screenshot */}
                <CardFooter className="px-6 py-4 mt-auto border-t border-white/5 bg-transparent flex flex-col gap-3">
                  <div className="flex justify-between items-center w-full">
                    <span className="text-xs text-zinc-500 font-medium">Priority {job.priority}</span>
                    <span className={`text-xs font-bold ${statusColor}`}>100%</span>
                  </div>
                  
                  {/* Glowing Progress Bar */}
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${barColor} ${shadowColor}`} 
                      style={{ width: "100%" }}
                    />
                  </div>
                </CardFooter>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
