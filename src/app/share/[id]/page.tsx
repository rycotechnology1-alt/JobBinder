import { Download, AlertTriangle, Clock, HardHat, FileArchive, Building2 } from "lucide-react";
import prisma from "@/lib/prisma";

type Props = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

function getCurrentTimestamp() {
  return Date.now();
}

export default async function ShareDownloadPage({ params }: Props) {
  const { id } = await params;
  const currentTimestamp = getCurrentTimestamp();

  const exportRecord = await prisma.export.findFirst({
    where: { id },
    include: {
      job: {
        include: { company: true },
      },
    },
  });

  const isMissing =
    !exportRecord ||
    exportRecord.destination !== "SHARE_LINK" ||
    exportRecord.status !== "READY";

  const isExpired =
    exportRecord?.expiresAt && exportRecord.expiresAt.getTime() < currentTimestamp;

  if (isMissing || isExpired) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in duration-500">
        <div className="glass-card rounded-2xl p-8 md:p-12 max-w-md text-center space-y-5 border border-zinc-800/80">
          <div className="h-16 w-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <AlertTriangle size={32} />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-zinc-50">
              {isExpired ? "Share Link Expired" : "Link Not Found"}
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {isExpired
                ? "This share link has expired and is no longer available. Please contact the sender to generate a new one."
                : "This share link is invalid, no longer active, or the package is still being prepared. Please double-check the URL or contact the sender."}
            </p>
          </div>
          <div className="pt-2 text-[11px] text-zinc-600 uppercase tracking-widest font-semibold">
            JobBinder
          </div>
        </div>
      </div>
    );
  }

  const job = exportRecord.job;
  const company = job.company;
  const expiresAt = exportRecord.expiresAt;
  const daysRemaining = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - currentTimestamp) / (24 * 60 * 60 * 1000)))
    : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-8 animate-in fade-in duration-500">
      <div className="glass-card rounded-2xl max-w-xl w-full overflow-hidden border border-zinc-800/80 shadow-2xl shadow-black/40">
        {/* Branded header */}
        <div className="bg-gradient-to-br from-brand/15 via-brand/5 to-transparent border-b border-zinc-800/60 p-6 md:p-8 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand flex items-center justify-center shadow-lg shadow-brand/30 shrink-0">
            <HardHat size={22} className="text-white" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-light/80">
              Project Handoff Package
            </div>
            <div className="text-sm font-semibold text-zinc-100 mt-0.5">
              Shared via JobBinder
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 space-y-6">
          <div className="space-y-3">
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-50 leading-tight">
              {job.title}
            </h1>
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Building2 size={14} className="text-zinc-500" />
              <span className="font-medium text-zinc-300">{company.name}</span>
            </div>
          </div>

          {/* File info */}
          <div className="rounded-xl border border-zinc-800/80 bg-black/20 p-4 flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <FileArchive size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                File
              </div>
              <div className="font-mono text-xs text-zinc-200 break-all">
                {exportRecord.fileName || "Job-Package-Export.zip"}
              </div>
            </div>
          </div>

          {/* Expiration warning */}
          {expiresAt && (
            <div
              className={`rounded-xl border p-4 flex items-start gap-3 ${
                daysRemaining !== null && daysRemaining <= 2
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-zinc-800/80 bg-black/20"
              }`}
            >
              <Clock
                size={16}
                className={`mt-0.5 shrink-0 ${
                  daysRemaining !== null && daysRemaining <= 2 ? "text-amber-400" : "text-zinc-500"
                }`}
              />
              <div className="text-xs space-y-0.5">
                <div className="font-semibold text-zinc-200">
                  {daysRemaining === 0
                    ? "Expires today"
                    : daysRemaining === 1
                    ? "Expires tomorrow"
                    : `Expires in ${daysRemaining} days`}
                </div>
                <div className="text-zinc-500">
                  {expiresAt.toLocaleString(undefined, {
                    dateStyle: "long",
                    timeStyle: "short",
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Download CTA */}
          <a
            href={`/api/share/${exportRecord.id}/download`}
            className="flex items-center justify-center gap-2 w-full h-14 rounded-xl bg-emerald-600 hover:bg-emerald-500 transition-colors font-semibold text-white text-base shadow-lg shadow-emerald-950/30"
          >
            <Download size={18} />
            Download ZIP Package
          </a>

          <p className="text-[11px] text-center text-zinc-600 leading-relaxed">
            This package was prepared and shared securely from JobBinder. Only people with this link can access the
            file.
          </p>
        </div>
      </div>
    </div>
  );
}
