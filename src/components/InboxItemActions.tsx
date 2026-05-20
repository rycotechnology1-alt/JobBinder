"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type InboxItemType = "note" | "file";

type JobOption = {
  id: string;
  title: string;
  customerName: string | null;
};

type Props = {
  itemType: InboxItemType;
  itemId: string;
  jobs: JobOption[];
};

export function InboxItemActions({ itemType, itemId, jobs }: Props) {
  const router = useRouter();
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState(jobs[0]?.id ?? "");
  const [isAssigning, setIsAssigning] = useState(false);
  const [isOpeningFile, setIsOpeningFile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleViewFile() {
    setError(null);
    setIsOpeningFile(true);

    try {
      const response = await fetch(`/api/files/${itemId}/access-url`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not open file.");
      }

      window.open(payload.accessUrl, "_blank", "noopener,noreferrer");
    } catch (viewError) {
      setError(viewError instanceof Error ? viewError.message : "Could not open file.");
    } finally {
      setIsOpeningFile(false);
    }
  }

  async function handleAssign() {
    if (!selectedJobId) {
      setError("Choose a job first.");
      return;
    }

    setError(null);
    setIsAssigning(true);

    try {
      const response = await fetch(itemType === "note" ? "/api/notes" : "/api/files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: itemId, jobId: selectedJobId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not assign item.");
      }

      setIsAssignOpen(false);
      router.refresh();
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : "Could not assign item.");
    } finally {
      setIsAssigning(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        {itemType === "file" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleViewFile}
            disabled={isOpeningFile}
            className="gap-2"
          >
            <ExternalLink size={15} />
            {isOpeningFile ? "Opening..." : "View"}
          </Button>
        )}
        <Button type="button" variant="secondary" size="sm" onClick={() => setIsAssignOpen(true)}>
          Assign to Job
        </Button>
      </div>
      {error && !isAssignOpen && <p className="mt-2 text-right text-xs text-red-400">{error}</p>}

      <Modal isOpen={isAssignOpen} onClose={() => setIsAssignOpen(false)} title="Assign to Job">
        <div className="space-y-4">
          {jobs.length === 0 ? (
            <p className="text-sm text-zinc-400">Create a job before assigning inbox items.</p>
          ) : (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-zinc-400">Choose a job folder</legend>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {jobs.map((job) => (
                  <label
                    key={job.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-3 text-sm text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
                  >
                    <input
                      type="radio"
                      name="jobId"
                      value={job.id}
                      aria-label={job.title}
                      checked={selectedJobId === job.id}
                      onChange={() => setSelectedJobId(job.id)}
                      className="mt-1 h-4 w-4 border-zinc-700 bg-zinc-900 text-brand focus:ring-brand"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-zinc-100">{job.title}</span>
                      {job.customerName && <span className="block text-xs text-zinc-500">{job.customerName}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsAssignOpen(false)} disabled={isAssigning}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAssign} disabled={isAssigning || jobs.length === 0}>
              {isAssigning ? "Assigning..." : "Assign"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
