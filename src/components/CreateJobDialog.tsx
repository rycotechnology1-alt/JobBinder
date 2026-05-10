"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";

interface Props {
  companyId: string;
  userId: string;
}

export function CreateJobDialog({ companyId, userId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const title = formData.get("title");
    const customerName = formData.get("customerName");
    
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          title,
          customerName,
          createdById: userId,
        }),
      });
      
      if (res.ok) {
        setIsOpen(false);
        router.refresh(); // Refresh the dashboard to show new job
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Card 
        onClick={() => setIsOpen(true)}
        className="group cursor-pointer border-dashed border-2 border-white/10 hover:border-brand/50 hover:bg-brand/5 transition-all duration-300 min-h-[220px] flex flex-col items-center justify-center text-center"
      >
        <CardContent className="p-8 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-brand group-hover:border-brand transition-all duration-300 shadow-[0_0_15px_rgba(0,0,0,0)] group-hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]">
            <Plus size={24} className="text-zinc-400 group-hover:text-white transition-colors" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Start New Project</h3>
            <p className="text-xs text-zinc-500">Create a blank job folder</p>
          </div>
        </CardContent>
      </Card>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Start New Project">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Job Title *</label>
            <Input name="title" required placeholder="e.g. Downtown Plumbing Fitout" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Customer Name</label>
            <Input name="customerName" placeholder="e.g. John Smith" />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Job Folder"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
