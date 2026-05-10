"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Camera, ClipboardList, FileText } from "lucide-react";

interface Props {
  jobId: string;
  companyId: string;
  authorId: string;
}

export function JobActions({ jobId, companyId, authorId }: Props) {
  const [activeModal, setActiveModal] = useState<"NONE" | "NOTE" | "PROGRESS" | "PHOTO">("NONE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function handleAddNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const content = formData.get("content");
    
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          jobId,
          authorId,
          type: activeModal === "PROGRESS" ? "PROGRESS" : "GENERAL",
          content,
          statusTag: activeModal === "PROGRESS" ? formData.get("statusTag") : undefined,
        }),
      });
      if (res.ok) {
        setActiveModal("NONE");
        router.refresh();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {/* Desktop Buttons */}
      <div className="hidden md:flex justify-end gap-3 mb-4">
        <Button variant="secondary" className="gap-2" onClick={() => setActiveModal("PHOTO")}>
          <Camera size={16}/> Add Photo
        </Button>
        <Button variant="secondary" className="gap-2" onClick={() => setActiveModal("PROGRESS")}>
          <ClipboardList size={16}/> Log Progress
        </Button>
        <Button className="gap-2" onClick={() => setActiveModal("NOTE")}>
          <FileText size={16}/> Add Note
        </Button>
      </div>

      {/* Mobile Buttons */}
      <div className="grid grid-cols-3 gap-3 md:hidden mb-6">
        <Button variant="secondary" className="flex-col h-auto py-3 gap-2 text-xs" onClick={() => setActiveModal("PHOTO")}>
          <Camera size={20} className="text-brand-light" />
          Photo
        </Button>
        <Button variant="secondary" className="flex-col h-auto py-3 gap-2 text-xs" onClick={() => setActiveModal("PROGRESS")}>
          <ClipboardList size={20} className="text-emerald-400" />
          Progress
        </Button>
        <Button variant="secondary" className="flex-col h-auto py-3 gap-2 text-xs" onClick={() => setActiveModal("NOTE")}>
          <FileText size={20} className="text-purple-400" />
          Note
        </Button>
      </div>

      <Modal isOpen={activeModal === "NOTE" || activeModal === "PROGRESS"} onClose={() => setActiveModal("NONE")} title={activeModal === "PROGRESS" ? "Log Progress" : "Add Note"}>
        <form onSubmit={handleAddNote} className="space-y-4">
          {activeModal === "PROGRESS" && (
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Status Tag</label>
              <Input name="statusTag" placeholder="e.g. Rough-in complete" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              {activeModal === "PROGRESS" ? "Work Performed *" : "Note Details *"}
            </label>
            <textarea 
              name="content" 
              required 
              rows={4}
              className="flex w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 resize-none"
              placeholder={activeModal === "PROGRESS" ? "What was completed today?" : "Enter your note here..."}
              autoFocus
            />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setActiveModal("NONE")}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={activeModal === "PHOTO"} onClose={() => setActiveModal("NONE")} title="Upload Photo">
        <div className="py-8 text-center text-zinc-400">
          <Camera size={48} className="mx-auto mb-4 opacity-50" />
          <p>Cloudflare R2 integration pending.</p>
          <p className="text-sm mt-2">For MVP Step 8, let's test the Note creation first!</p>
        </div>
      </Modal>
    </>
  );
}
