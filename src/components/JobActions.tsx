"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Camera, ClipboardList, FileText, ListTodo } from "lucide-react";
import { AssetCategorySelect } from "@/components/AssetCategorySelect";
import { AssetUploadModal } from "@/components/AssetUploadModal";

interface Props {
  jobId: string;
}

export function JobActions({ jobId }: Props) {
  const [activeModal, setActiveModal] = useState<"NONE" | "NOTE" | "PROGRESS" | "UPLOAD" | "TASK">("NONE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createTaskFromNote, setCreateTaskFromNote] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const router = useRouter();

  function closeModal() {
    setActiveModal("NONE");
    setCreateTaskFromNote(false);
    setSubmitError(null);
  }

  async function handleAddNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const content = formData.get("content")?.toString() || "";
    const taskTitle = formData.get("taskTitle")?.toString().trim() || "";
    const taskDescription = formData.get("taskDescription")?.toString().trim() || content;
    const shouldCreateTask = activeModal === "NOTE" && createTaskFromNote;
    setSubmitError(null);

    if (shouldCreateTask && !taskTitle) {
      setSubmitError("Task title is required.");
      setIsSubmitting(false);
      return;
    }
    
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          type: activeModal === "PROGRESS" ? "PROGRESS" : "GENERAL",
          content,
          category: formData.get("category"),
          statusTag: activeModal === "PROGRESS" ? formData.get("statusTag") : undefined,
        }),
      });

      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error || "Could not save note.");
      }

      if (shouldCreateTask) {
        const taskRes = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            title: taskTitle,
            description: taskDescription,
            type: "TASK",
          }),
        });

        if (!taskRes.ok) {
          const payload = await taskRes.json();
          throw new Error(payload.error || "Could not create task.");
        }
      }

      closeModal();
      router.refresh();
    } catch (error) {
      console.error(error);
      setSubmitError(error instanceof Error ? error.message : "Could not save note.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get("title")?.toString().trim() || "";
    const description = formData.get("description")?.toString().trim() || "";
    const type = formData.get("type")?.toString() || "TASK";
    const dueDate = formData.get("dueDate")?.toString() || "";

    setSubmitError(null);

    if (!title) {
      setSubmitError("Task title is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          title,
          description,
          type,
          dueDate,
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "Could not create task.");
      }

      closeModal();
      router.refresh();
    } catch (error) {
      console.error(error);
      setSubmitError(error instanceof Error ? error.message : "Could not create task.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {/* Desktop Buttons */}
      <div className="hidden md:flex justify-end gap-3 mb-4">
        <Button variant="secondary" className="gap-2" onClick={() => setActiveModal("UPLOAD")}>
          <Camera size={16}/> Upload
        </Button>
        <Button variant="secondary" className="gap-2" onClick={() => setActiveModal("TASK")}>
          <ListTodo size={16}/> Quick Task
        </Button>
        <Button variant="secondary" className="gap-2" onClick={() => setActiveModal("PROGRESS")}>
          <ClipboardList size={16}/> Log Progress
        </Button>
        <Button className="gap-2" onClick={() => setActiveModal("NOTE")}>
          <FileText size={16}/> Add Note
        </Button>
      </div>

      {/* Mobile Buttons */}
      <div className="grid grid-cols-4 gap-3 md:hidden mb-6">
        <Button variant="secondary" className="flex-col h-auto py-3 gap-2 text-xs" onClick={() => setActiveModal("UPLOAD")}>
          <Camera size={20} className="text-brand-light" />
          Upload
        </Button>
        <Button variant="secondary" className="flex-col h-auto py-3 gap-2 text-xs" onClick={() => setActiveModal("TASK")}>
          <ListTodo size={20} className="text-amber-400" />
          Task
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

      <Modal isOpen={activeModal === "NOTE" || activeModal === "PROGRESS"} onClose={closeModal} title={activeModal === "PROGRESS" ? "Log Progress" : "Add Note"}>
        <form onSubmit={handleAddNote} className="space-y-4">
          {activeModal === "PROGRESS" && (
            <div>
              <label htmlFor="statusTag" className="block text-sm font-medium text-zinc-400 mb-1">Status Tag</label>
              <Input id="statusTag" name="statusTag" placeholder="e.g. Rough-in complete" />
            </div>
          )}
          <div>
            <label htmlFor="note-content" className="block text-sm font-medium text-zinc-400 mb-1">
              {activeModal === "PROGRESS" ? "Work Performed *" : "Note Details *"}
            </label>
            <textarea 
              id="note-content"
              name="content" 
              required 
              rows={4}
              className="flex w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 resize-none"
              placeholder={activeModal === "PROGRESS" ? "What was completed today?" : "Enter your note here..."}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Category</label>
            <AssetCategorySelect />
          </div>
          {activeModal === "NOTE" && (
            <div className="rounded-xl border border-zinc-800 bg-black/20 p-4 space-y-4">
              <label className="flex items-center gap-3 text-sm font-medium text-zinc-200">
                <input
                  type="checkbox"
                  name="createTask"
                  checked={createTaskFromNote}
                  onChange={(event) => setCreateTaskFromNote(event.target.checked)}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-brand focus:ring-brand"
                />
                Create task from this note
              </label>
              {createTaskFromNote && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="taskTitle" className="block text-sm font-medium text-zinc-400 mb-1">Task Title *</label>
                    <Input id="taskTitle" name="taskTitle" required={createTaskFromNote} placeholder="e.g. Finish closeout checklist" />
                  </div>
                  <div>
                    <label htmlFor="taskDescription" className="block text-sm font-medium text-zinc-400 mb-1">Task Description</label>
                    <textarea
                      id="taskDescription"
                      name="taskDescription"
                      rows={3}
                      className="flex w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 resize-none"
                      placeholder="Defaults to the note details"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          {submitError && <p className="text-sm text-red-400">{submitError}</p>}
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={activeModal === "TASK"} onClose={closeModal} title="Quick Add Task/Punch List">
        <form onSubmit={handleAddTask} className="space-y-4">
          <div>
            <label htmlFor="task-title" className="block text-sm font-medium text-zinc-400 mb-1">Title *</label>
            <Input id="task-title" name="title" placeholder="e.g. Touch up stair trim" autoFocus />
          </div>

          <fieldset className="space-y-2">
            <legend className="block text-sm font-medium text-zinc-400">Type</legend>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200">
                <input
                  type="radio"
                  name="type"
                  value="TASK"
                  defaultChecked
                  className="h-4 w-4 border-zinc-700 bg-zinc-900 text-brand focus:ring-brand"
                />
                Task
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200">
                <input
                  type="radio"
                  name="type"
                  value="PUNCH_LIST"
                  className="h-4 w-4 border-zinc-700 bg-zinc-900 text-brand focus:ring-brand"
                />
                Punch List
              </label>
            </div>
          </fieldset>

          <div>
            <label htmlFor="task-description" className="block text-sm font-medium text-zinc-400 mb-1">Description</label>
            <textarea
              id="task-description"
              name="description"
              rows={3}
              className="flex w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 resize-none"
              placeholder="Optional details"
            />
          </div>

          <div>
            <label htmlFor="task-due-date" className="block text-sm font-medium text-zinc-400 mb-1">Due Date</label>
            <Input id="task-due-date" name="dueDate" type="date" />
          </div>

          {submitError && <p className="text-sm text-red-400">{submitError}</p>}

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </Modal>

      <AssetUploadModal
        isOpen={activeModal === "UPLOAD"}
        onClose={closeModal}
        jobId={jobId}
        title="Upload to Job Folder"
      />
    </>
  );
}
