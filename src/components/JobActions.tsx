"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Archive, Camera, ClipboardList, FileText, ListTodo, MoreHorizontal, Plus, Settings2, Trash2 } from "lucide-react";
import { AssetCategorySelect } from "@/components/AssetCategorySelect";
import { AssetUploadModal } from "@/components/AssetUploadModal";
import { ExportModal } from "@/components/ExportModal";
import { queueOfflineDailyReport, queueOfflineNote, queueOfflineTask } from "@/lib/offline-sync/queue";
import { getMimeTypeForFilename, validateSupportedUploadType } from "@/lib/asset-categories";
import {
  ACCEPTED_UPLOAD_TYPES,
  isOffline,
  prepareClientUploadFile,
  uploadFileRecord,
} from "@/lib/uploads/client-upload";
import { DeleteConfirmationButton } from "@/components/DeleteConfirmationButton";
import { cn } from "@/lib/utils";

interface Props {
  jobId: string;
  isAdmin?: boolean;
  /** Opens the Manage Job dialog (owned by the header). When omitted, the menu item is hidden. */
  onManageJob?: () => void;
}

export function JobActions({ jobId, isAdmin = false, onManageJob }: Props) {
  const [activeModal, setActiveModal] = useState<"NONE" | "NOTE" | "DAILY_REPORT" | "UPLOAD" | "TASK" | "EXPORT">("NONE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createTaskFromNote, setCreateTaskFromNote] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [dailyReportFiles, setDailyReportFiles] = useState<File[]>([]);
  const [taskFiles, setTaskFiles] = useState<File[]>([]);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [jobDeleteOpen, setJobDeleteOpen] = useState(false);
  const newMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!newMenuRef.current?.contains(event.target as Node)) setNewMenuOpen(false);
      if (!moreMenuRef.current?.contains(event.target as Node)) setMoreMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function openModalFromMenu(modal: "NOTE" | "DAILY_REPORT" | "UPLOAD" | "TASK" | "EXPORT") {
    setNewMenuOpen(false);
    setMoreMenuOpen(false);
    setActiveModal(modal);
  }

  function closeModal() {
    setActiveModal("NONE");
    setCreateTaskFromNote(false);
    setDailyReportFiles([]);
    setTaskFiles([]);
    setSubmitError(null);
  }

  function isNetworkCaptureError(error: unknown) {
    return isOffline() || error instanceof TypeError;
  }

  function todayInputDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function appendDailyReportFiles(files: FileList | null) {
    const nextFiles = Array.from(files ?? []).filter((file) => file.size > 0);
    if (nextFiles.length === 0) return;
    setDailyReportFiles((currentFiles) => [...currentFiles, ...nextFiles]);
  }

  function appendTaskFiles(files: FileList | null) {
    const nextFiles = Array.from(files ?? []).filter((file) => file.size > 0);
    if (nextFiles.length === 0) return;
    setTaskFiles((currentFiles) => [...currentFiles, ...nextFiles]);
  }

  function buildOfflineAttachment(file: File) {
    const contentType = file.type || getMimeTypeForFilename(file.name) || "";
    const validation = validateSupportedUploadType({
      filename: file.name,
      contentType,
    });

    if (!validation.ok) throw new Error(validation.error);

    return {
      originalName: file.name,
      name: "",
      contentType: validation.contentType,
      blob: file,
    };
  }

  async function handleAddNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const content = formData.get("content")?.toString() || "";
    const category = formData.get("category")?.toString() || "Misc";
    const taskTitle = formData.get("taskTitle")?.toString().trim() || "";
    const taskDescription = formData.get("taskDescription")?.toString().trim() || content;
    const shouldCreateTask = activeModal === "NOTE" && createTaskFromNote;
    setSubmitError(null);

    if (shouldCreateTask && !taskTitle) {
      setSubmitError("Task title is required.");
      setIsSubmitting(false);
      return;
    }

    const noteInput = {
      jobId,
      type: "GENERAL" as const,
      content,
      category,
      statusTag: null,
    };

    async function queueCapture() {
      await queueOfflineNote(noteInput);
      if (shouldCreateTask) {
        await queueOfflineTask({
          jobId,
          title: taskTitle,
          description: taskDescription,
          type: "TASK",
          dueDate: "",
        });
      }
    }

    if (isOffline()) {
      try {
        await queueCapture();
        closeModal();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Could not save offline capture.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(noteInput),
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
      if (isNetworkCaptureError(error)) {
        try {
          await queueCapture();
          closeModal();
        } catch (queueError) {
          setSubmitError(queueError instanceof Error ? queueError.message : "Could not save offline capture.");
        }
      } else {
        setSubmitError(error instanceof Error ? error.message : "Could not save note.");
      }
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

    const taskInput = {
      jobId,
      title,
      description,
      type: type === "PUNCH_LIST" ? ("PUNCH_LIST" as const) : ("TASK" as const),
      dueDate,
    };

    if (isOffline()) {
      if (taskFiles.length > 0) {
        setSubmitError("Connect to upload task attachments.");
        setIsSubmitting(false);
        return;
      }

      try {
        await queueOfflineTask(taskInput);
        closeModal();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Could not save offline task.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    try {
      const preparedAttachments: Awaited<ReturnType<typeof prepareClientUploadFile>>[] = [];
      for (const file of taskFiles) {
        preparedAttachments.push(await prepareClientUploadFile(file));
      }

      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskInput),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "Could not create task.");
      }

      const task = await response.json();
      if (!task?.id) {
        throw new Error("Task was created without an id.");
      }

      for (const prepared of preparedAttachments) {
        await uploadFileRecord({
          jobId,
          taskId: task.id,
          originalName: prepared.sourceFile.name,
          name: "",
          category: "Misc",
          prepared,
        });
      }

      closeModal();
      router.refresh();
    } catch (error) {
      console.error(error);
      if (isNetworkCaptureError(error)) {
        if (taskFiles.length > 0) {
          setSubmitError("Connect to upload task attachments.");
          return;
        }

        try {
          await queueOfflineTask(taskInput);
          closeModal();
        } catch (queueError) {
          setSubmitError(queueError instanceof Error ? queueError.message : "Could not save offline task.");
        }
      } else {
        setSubmitError(error instanceof Error ? error.message : "Could not create task.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddDailyReport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const reportDate = formData.get("reportDate")?.toString() || "";
    const workPerformed = formData.get("workPerformed")?.toString().trim() || "";
    const materialsUsed = formData.get("materialsUsed")?.toString().trim() || "";

    setSubmitError(null);

    if (!workPerformed) {
      setSubmitError("Work performed is required.");
      return;
    }

    setIsSubmitting(true);

    if (isOffline()) {
      try {
        await queueOfflineDailyReport({
          jobId,
          reportDate,
          workPerformed,
          materialsUsed,
          attachments: dailyReportFiles.map(buildOfflineAttachment),
        });
        closeModal();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Could not save offline daily report.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    try {
      const preparedAttachments: Awaited<ReturnType<typeof prepareClientUploadFile>>[] = [];
      for (const file of dailyReportFiles) {
        preparedAttachments.push(await prepareClientUploadFile(file));
      }

      const response = await fetch("/api/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          reportDate,
          workPerformed,
          materialsUsed,
        }),
      });

      const report = await response.json();
      if (!response.ok) {
        throw new Error(report.error || "Could not save daily report.");
      }

      for (const prepared of preparedAttachments) {
        await uploadFileRecord({
          jobId,
          noteId: report.id,
          originalName: prepared.sourceFile.name,
          name: "",
          category: "Misc",
          prepared,
        });
      }

      closeModal();
      router.refresh();
    } catch (error) {
      console.error(error);
      if (isNetworkCaptureError(error)) {
        try {
          await queueOfflineDailyReport({
            jobId,
            reportDate,
            workPerformed,
            materialsUsed,
            attachments: dailyReportFiles.map(buildOfflineAttachment),
          });
          closeModal();
        } catch (queueError) {
          setSubmitError(queueError instanceof Error ? queueError.message : "Could not save offline daily report.");
        }
      } else {
        setSubmitError(error instanceof Error ? error.message : "Could not save daily report.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* + New menu */}
        <div ref={newMenuRef} className="relative">
          <Button
            size="sm"
            aria-label="New"
            aria-haspopup="menu"
            aria-expanded={newMenuOpen}
            className="gap-1.5 whitespace-nowrap"
            onClick={() => {
              setMoreMenuOpen(false);
              setNewMenuOpen((current) => !current);
            }}
          >
            <Plus size={16} /> New
          </Button>
          {newMenuOpen && (
            <div className="absolute right-0 top-11 z-50 w-52 rounded-xl border border-zinc-800 bg-zinc-950/95 p-2 shadow-2xl shadow-black/40 backdrop-blur">
              <MenuItem icon={<Camera size={16} className="text-brand-light" />} label="Upload" ariaLabel="Upload" onClick={() => openModalFromMenu("UPLOAD")} />
              <MenuItem icon={<ListTodo size={16} className="text-amber-400" />} label="Task" ariaLabel="Quick Task" onClick={() => openModalFromMenu("TASK")} />
              <MenuItem icon={<ClipboardList size={16} className="text-emerald-400" />} label="Daily Report" ariaLabel="Daily Report" onClick={() => openModalFromMenu("DAILY_REPORT")} />
              <MenuItem icon={<FileText size={16} className="text-purple-400" />} label="Note" ariaLabel="Add Note" onClick={() => openModalFromMenu("NOTE")} />
            </div>
          )}
        </div>

        {/* Overflow menu */}
        <div ref={moreMenuRef} className="relative">
          <Button
            variant="outline"
            size="sm"
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={moreMenuOpen}
            className="px-2 border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            onClick={() => {
              setNewMenuOpen(false);
              setMoreMenuOpen((current) => !current);
            }}
          >
            <MoreHorizontal size={18} />
          </Button>
          {moreMenuOpen && (
            <div className="absolute right-0 top-11 z-50 w-56 rounded-xl border border-zinc-800 bg-zinc-950/95 p-2 shadow-2xl shadow-black/40 backdrop-blur">
              {onManageJob && (
                <MenuItem
                  icon={<Settings2 size={16} className="text-zinc-400" />}
                  label="Manage Job"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    onManageJob();
                  }}
                />
              )}
              <MenuItem icon={<Archive size={16} className="text-brand-light" />} label="Export Job Package" ariaLabel="Export Job Package" onClick={() => openModalFromMenu("EXPORT")} />
              {isAdmin && (
                <MenuItem
                  icon={<Trash2 size={16} className="text-red-400" />}
                  label="Delete Job"
                  ariaLabel="Delete job"
                  destructive
                  onClick={() => {
                    setMoreMenuOpen(false);
                    setJobDeleteOpen(true);
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {isAdmin && (
        <DeleteConfirmationButton
          endpoint={`/api/jobs/${jobId}`}
          label="Delete job"
          title="Delete job"
          message="Delete this job and all of its notes, files, tasks, exports, and stored uploads? This cannot be undone."
          showTrigger={false}
          open={jobDeleteOpen}
          onOpenChange={setJobDeleteOpen}
          onDeleted={() => {
            router.push("/");
            router.refresh();
          }}
        />
      )}

      <Modal isOpen={activeModal === "NOTE"} onClose={closeModal} title="Add Note">
        <form onSubmit={handleAddNote} className="space-y-4">
          <div>
            <label htmlFor="note-content" className="block text-sm font-medium text-zinc-400 mb-1">
              Note Details *
            </label>
            <textarea 
              id="note-content"
              name="content" 
              required 
              rows={4}
              className="flex w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 resize-none"
              placeholder="Enter your note here..."
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Category</label>
            <AssetCategorySelect id="note-category" />
          </div>
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
          {submitError && <p className="text-sm text-red-400">{submitError}</p>}
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={activeModal === "DAILY_REPORT"} onClose={closeModal} title="Daily Report">
        <form onSubmit={handleAddDailyReport} className="space-y-4">
          <div>
            <label htmlFor="report-date" className="block text-sm font-medium text-zinc-400 mb-1">Report Date *</label>
            <Input id="report-date" name="reportDate" type="date" required defaultValue={todayInputDate()} />
          </div>

          <div>
            <label htmlFor="work-performed" className="block text-sm font-medium text-zinc-400 mb-1">Work Performed *</label>
            <textarea
              id="work-performed"
              name="workPerformed"
              required
              rows={4}
              className="flex w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 resize-none"
              placeholder="What was completed today?"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="materials-used" className="block text-sm font-medium text-zinc-400 mb-1">Materials Used</label>
            <textarea
              id="materials-used"
              name="materialsUsed"
              rows={3}
              className="flex w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 resize-none"
              placeholder="Materials, quantities, tickets, or notes"
            />
          </div>

          <div className="rounded-xl border border-dashed border-zinc-700 bg-black/20 p-4">
            <label htmlFor="daily-report-files" className="block text-sm font-medium text-zinc-300 mb-2">
              Attach files or photos
            </label>
            <input
              id="daily-report-files"
              type="file"
              multiple
              accept={ACCEPTED_UPLOAD_TYPES}
              onChange={(event) => appendDailyReportFiles(event.currentTarget.files)}
              className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-100 hover:file:bg-zinc-700"
            />
            <input
              id="daily-report-camera"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                appendDailyReportFiles(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => document.getElementById("daily-report-camera")?.click()}
              className="md:hidden mt-3 w-full gap-2"
            >
              <Camera size={18} />
              Take Photo
            </Button>
            {dailyReportFiles.length > 0 && (
              <div className="mt-3 space-y-1">
                {dailyReportFiles.map((file, index) => (
                  <p key={`${file.name}-${file.size}-${index}`} className="text-xs text-brand-light">
                    {file.name}
                  </p>
                ))}
              </div>
            )}
          </div>

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

          <div className="rounded-xl border border-dashed border-zinc-700 bg-black/20 p-4">
            <label htmlFor="task-files" className="block text-sm font-medium text-zinc-300 mb-2">
              Attach files or photos
            </label>
            <input
              id="task-files"
              type="file"
              multiple
              accept={ACCEPTED_UPLOAD_TYPES}
              onChange={(event) => appendTaskFiles(event.currentTarget.files)}
              className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-100 hover:file:bg-zinc-700"
            />
            <input
              id="task-camera"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                appendTaskFiles(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => document.getElementById("task-camera")?.click()}
              className="md:hidden mt-3 w-full gap-2"
            >
              <Camera size={18} />
              Take Photo
            </Button>
            {taskFiles.length > 0 && (
              <div className="mt-3 space-y-1">
                {taskFiles.map((file, index) => (
                  <p key={`${file.name}-${file.size}-${index}`} className="text-xs text-brand-light">
                    {file.name}
                  </p>
                ))}
              </div>
            )}
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

      <ExportModal
        isOpen={activeModal === "EXPORT"}
        onClose={closeModal}
        jobId={jobId}
        jobTitle="this Job folder"
      />
    </>
  );
}

function MenuItem({
  icon,
  label,
  ariaLabel,
  destructive = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  ariaLabel?: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? label}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
        destructive
          ? "text-red-400 hover:bg-red-500/10"
          : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
