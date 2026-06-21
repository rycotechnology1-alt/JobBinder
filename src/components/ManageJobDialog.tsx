"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings2 } from "lucide-react";
import { JOB_STATUSES, getJobStatusDisplay, getPriorityDisplay } from "@/lib/job-management";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

type ManageableJob = {
  id: string;
  title: string;
  jobNumber: string | null;
  poNumber: string | null;
  contractNumber: string | null;
  customerName: string | null;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  description: string | null;
  status: string;
  priority: number;
  targetCompletionDate: string | null;
};

type Props = {
  job: ManageableJob;
  isAdmin: boolean;
  /** Controlled open state. When provided, the dialog becomes controlled. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Render the built-in "Manage Job" trigger button. Defaults to true. */
  showTrigger?: boolean;
};

export function ManageJobDialog({ job, isAdmin, open, onOpenChange, showTrigger = true }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function setOpen(next: boolean) {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload: Record<string, string | number> = {
      id: job.id,
      title: formData.get("title")?.toString() ?? "",
      customerName: formData.get("customerName")?.toString() ?? "",
      address: formData.get("address")?.toString() ?? "",
      description: formData.get("description")?.toString() ?? "",
      jobNumber: formData.get("jobNumber")?.toString() ?? "",
      poNumber: formData.get("poNumber")?.toString() ?? "",
      contractNumber: formData.get("contractNumber")?.toString() ?? "",
      contactName: formData.get("contactName")?.toString() ?? "",
      contactPhone: formData.get("contactPhone")?.toString() ?? "",
      contactEmail: formData.get("contactEmail")?.toString() ?? "",
    };

    if (isAdmin) {
      payload.status = formData.get("status")?.toString() ?? "ACTIVE";
      payload.priority = Number(formData.get("priority") ?? 3);
      payload.targetCompletionDate = formData.get("targetCompletionDate")?.toString() ?? "";
    }

    try {
      const response = await fetch("/api/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Could not update job.");
      }

      setOpen(false);
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update job.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {showTrigger && (
        <Button type="button" variant="secondary" className="gap-2" onClick={() => setOpen(true)}>
          <Settings2 size={16} />
          Manage Job
        </Button>
      )}

      <Modal isOpen={isOpen} onClose={() => setOpen(false)} title="Manage Job" className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Basic Details</h3>
            <div>
              <label htmlFor="job-title" className="block text-sm font-medium text-zinc-400 mb-1">Job Title *</label>
              <Input id="job-title" name="title" required defaultValue={job.title} autoFocus />
            </div>
            <div>
              <label htmlFor="customerName" className="block text-sm font-medium text-zinc-400 mb-1">Customer Name</label>
              <Input id="customerName" name="customerName" defaultValue={job.customerName ?? ""} />
            </div>
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-zinc-400 mb-1">Address</label>
              <Input id="address" name="address" defaultValue={job.address ?? ""} />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-zinc-400 mb-1">Description</label>
              <textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={job.description ?? ""}
                className="flex w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 resize-none"
              />
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="jobNumber" className="block text-sm font-medium text-zinc-400 mb-1">Job Number</label>
              <Input id="jobNumber" name="jobNumber" defaultValue={job.jobNumber ?? ""} />
            </div>
            <div>
              <label htmlFor="poNumber" className="block text-sm font-medium text-zinc-400 mb-1">PO Number</label>
              <Input id="poNumber" name="poNumber" defaultValue={job.poNumber ?? ""} />
            </div>
            <div>
              <label htmlFor="contractNumber" className="block text-sm font-medium text-zinc-400 mb-1">Contract Number</label>
              <Input id="contractNumber" name="contractNumber" defaultValue={job.contractNumber ?? ""} />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Primary Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="contactName" className="block text-sm font-medium text-zinc-400 mb-1">Contact Name</label>
                <Input id="contactName" name="contactName" defaultValue={job.contactName ?? ""} />
              </div>
              <div>
                <label htmlFor="contactPhone" className="block text-sm font-medium text-zinc-400 mb-1">Contact Phone</label>
                <Input id="contactPhone" name="contactPhone" defaultValue={job.contactPhone ?? ""} />
              </div>
              <div>
                <label htmlFor="contactEmail" className="block text-sm font-medium text-zinc-400 mb-1">Contact Email</label>
                <Input id="contactEmail" name="contactEmail" type="email" defaultValue={job.contactEmail ?? ""} />
              </div>
            </div>
          </section>

          {isAdmin && (
            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Management</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-zinc-400 mb-1">Status</label>
                  <select id="status" name="status" defaultValue={job.status} className="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                    {JOB_STATUSES.map((status) => (
                      <option key={status} value={status}>{getJobStatusDisplay(status).label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="priority" className="block text-sm font-medium text-zinc-400 mb-1">Priority</label>
                  <select id="priority" name="priority" defaultValue={getPriorityDisplay(job.priority).value} className="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                    {[1, 2, 3, 4].map((priority) => (
                      <option key={priority} value={priority}>{getPriorityDisplay(priority).label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="targetCompletionDate" className="block text-sm font-medium text-zinc-400 mb-1">Target Completion Date</label>
                  <Input id="targetCompletionDate" name="targetCompletionDate" type="date" defaultValue={job.targetCompletionDate?.slice(0, 10) ?? ""} />
                </div>
              </div>
            </section>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Job"}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
