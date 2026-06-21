"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Clock3, PlayCircle, RotateCcw } from "lucide-react";
import { ASSET_CATEGORIES } from "@/lib/asset-categories";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FilePreview } from "@/components/FilePreview";
import { JobFeed } from "@/components/JobFeed";
import { JobPhotoGrid } from "@/components/job-workspace/JobPhotoGrid";
import { DeleteConfirmationButton } from "@/components/DeleteConfirmationButton";

export type JobSection = "FEED" | "FILES" | "PHOTOS" | "DAILY_REPORTS" | "TASKS";

export type NoteItem = {
  id: string;
  type: "GENERAL" | "PROGRESS" | "DAILY_REPORT";
  content: string;
  category: string | null;
  statusTag: string | null;
  reportDate: string | null;
  materialsUsed: string | null;
  createdAt: string;
  authorName: string;
};

export type FileItem = {
  id: string;
  type: "PHOTO" | "DOCUMENT";
  originalName: string;
  name: string | null;
  category: string | null;
  noteId: string | null;
  taskId?: string | null;
  markupMarkId?: string | null;
  createdAt: string;
};

export type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: "OPEN" | "IN_PROGRESS" | "DONE";
  type: "TASK" | "PUNCH_LIST";
  priority: number | null;
  dueDate: string | null;
  createdAt: string;
  files?: FileItem[];
};

type TaskStatus = TaskItem["status"];

type Props = {
  activeSection: JobSection;
  notes: NoteItem[];
  files: FileItem[];
  tasks: TaskItem[];
  isAdmin: boolean;
};

function sortTasks(tasks: TaskItem[]) {
  return [...tasks].sort((a, b) => {
    if (a.status === "DONE" && b.status !== "DONE") return 1;
    if (a.status !== "DONE" && b.status === "DONE") return -1;

    if (a.dueDate || b.dueDate) {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function isDailyReport(note: NoteItem) {
  return note.type === "DAILY_REPORT" || note.type === "PROGRESS";
}

function getReportDisplayDate(note: NoteItem) {
  return note.reportDate || note.createdAt;
}

function formatDisplayDate(value: string) {
  const dateOnly = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    const [year, month, day] = dateOnly.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString();
  }

  return new Date(value).toLocaleDateString();
}

export function JobSectionContent({ activeSection, notes, files, tasks: initialTasks, isAdmin }: Props) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [taskStatusOverrides, setTaskStatusOverrides] = useState<Record<string, TaskStatus>>({});
  const [taskError, setTaskError] = useState<string | null>(null);
  const router = useRouter();

  const tasks = useMemo(() => {
    return initialTasks.map((task) => ({
      ...task,
      status: taskStatusOverrides[task.id] ?? task.status,
    }));
  }, [taskStatusOverrides, initialTasks]);

  const dailyReports = useMemo(() => {
    return notes
      .filter(isDailyReport)
      .sort((a, b) => new Date(getReportDisplayDate(b)).getTime() - new Date(getReportDisplayDate(a)).getTime());
  }, [notes]);

  const documents = useMemo(() => files.filter((file) => file.type === "DOCUMENT"), [files]);
  const photos = useMemo(() => files.filter((file) => file.type === "PHOTO"), [files]);

  const documentCounts = useMemo(() => {
    return ASSET_CATEGORIES.reduce<Record<string, number>>((counts, category) => {
      counts[category] = documents.filter((file) => file.category === category).length;
      return counts;
    }, {});
  }, [documents]);

  const visibleDocuments = selectedCategory === "All"
    ? documents
    : documents.filter((file) => file.category === selectedCategory);

  const taskItems = useMemo(() => sortTasks(tasks.filter((task) => task.type === "TASK")), [tasks]);
  const punchListItems = useMemo(() => sortTasks(tasks.filter((task) => task.type === "PUNCH_LIST")), [tasks]);

  async function updateTaskStatus(taskId: string, status: TaskStatus) {
    setTaskError(null);
    const previousStatus = tasks.find((task) => task.id === taskId)?.status;
    setTaskStatusOverrides((currentStatuses) => ({
      ...currentStatuses,
      [taskId]: status,
    }));

    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "Could not update task.");
      }

      router.refresh();
    } catch (error) {
      setTaskStatusOverrides((currentStatuses) => {
        const nextStatuses = { ...currentStatuses };
        if (previousStatus) {
          nextStatuses[taskId] = previousStatus;
        } else {
          delete nextStatuses[taskId];
        }
        return nextStatuses;
      });
      setTaskError(error instanceof Error ? error.message : "Could not update task.");
    }
  }

  function refreshAfterDelete() {
    router.refresh();
  }

  return (
    <div className="p-4 md:p-6">
      {activeSection === "FEED" && (
        <JobFeed notes={notes} files={files} isAdmin={isAdmin} onItemDeleted={refreshAfterDelete} />
      )}

      {activeSection === "FILES" && (
        <div className="space-y-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              type="button"
              onClick={() => setSelectedCategory("All")}
              className={cn(
                "h-9 px-3 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors",
                selectedCategory === "All"
                  ? "bg-brand text-white border-brand"
                  : "bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700",
              )}
            >
              All ({documents.length})
            </button>
            {ASSET_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  "h-9 px-3 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors",
                  selectedCategory === category
                    ? "bg-brand text-white border-brand"
                    : "bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700",
                )}
              >
                {category} ({documentCounts[category] ?? 0})
              </button>
            ))}
          </div>

          {visibleDocuments.length === 0 ? (
            <p className="text-zinc-500 text-center py-10">No files in this category yet.</p>
          ) : (
            <div className="space-y-4">
              {visibleDocuments.map((file) => (
                <FilePreview
                  key={file.id}
                  fileId={file.id}
                  type={file.type}
                  filename={file.name || file.originalName}
                  category={file.category}
                  canDelete={isAdmin}
                  onDelete={refreshAfterDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === "PHOTOS" && (
        <JobPhotoGrid photos={photos} isAdmin={isAdmin} onDeleted={refreshAfterDelete} />
      )}

      {activeSection === "DAILY_REPORTS" && (
        dailyReports.length === 0 ? (
          <p className="text-zinc-500 text-center py-10">No daily reports yet.</p>
        ) : (
          <div className="space-y-4">
            {dailyReports.map((report) => (
              <DailyReportCard
                key={report.id}
                report={report}
                files={files.filter((file) => file.noteId === report.id)}
                isAdmin={isAdmin}
                onDeleted={refreshAfterDelete}
              />
            ))}
          </div>
        )
      )}

      {activeSection === "TASKS" && (
        <div className="space-y-8">
          {taskError && <p className="text-sm text-red-400">{taskError}</p>}

          <TaskSection
            title="Tasks"
            testId="tasks-section"
            emptyMessage="No tasks yet."
            tasks={taskItems}
            onStatusChange={updateTaskStatus}
            isAdmin={isAdmin}
            onDeleted={refreshAfterDelete}
          />

          <TaskSection
            title="Punch List"
            testId="punch-list-section"
            emptyMessage="No punch list items yet."
            tasks={punchListItems}
            onStatusChange={updateTaskStatus}
            isAdmin={isAdmin}
            onDeleted={refreshAfterDelete}
          />
        </div>
      )}
    </div>
  );
}

function TaskSection({
  title,
  testId,
  emptyMessage,
  tasks,
  onStatusChange,
  isAdmin,
  onDeleted,
}: {
  title: string;
  testId: string;
  emptyMessage: string;
  tasks: TaskItem[];
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  isAdmin: boolean;
  onDeleted: () => void;
}) {
  const incompleteTasks = tasks.filter((task) => task.status !== "DONE");
  const completedTasks = tasks.filter((task) => task.status === "DONE");

  return (
    <section data-testid={testId} className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
        <Badge variant="brand">{incompleteTasks.length}</Badge>
      </div>

      {tasks.length === 0 ? (
        <p className="text-zinc-500 text-center py-8">{emptyMessage}</p>
      ) : (
        <div className="space-y-3">
          {incompleteTasks.map((task) => (
            <TaskRow key={task.id} task={task} onStatusChange={onStatusChange} isAdmin={isAdmin} onDeleted={onDeleted} />
          ))}

          {completedTasks.length > 0 && (
            <div className="pt-2 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Completed</p>
              {completedTasks.map((task) => (
                <TaskRow key={task.id} task={task} onStatusChange={onStatusChange} isAdmin={isAdmin} onDeleted={onDeleted} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function TaskRow({
  task,
  onStatusChange,
  isAdmin,
  onDeleted,
}: {
  task: TaskItem;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  isAdmin: boolean;
  onDeleted: () => void;
}) {
  const isDone = task.status === "DONE";
  const nextAction = getNextTaskAction(task);

  return (
    <div className="rounded-xl border border-zinc-800 bg-black/20 p-4 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 text-zinc-500">
          {isDone ? <CheckCircle2 size={20} className="text-emerald-400" /> : <Circle size={20} />}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className={cn("font-medium text-sm", isDone ? "text-zinc-400 line-through" : "text-zinc-100")}>
              {task.title}
            </p>
            <Badge variant={task.type === "PUNCH_LIST" ? "brand" : "default"}>
              {task.type === "PUNCH_LIST" ? "Punch List" : "Task"}
            </Badge>
            {task.status === "OPEN" && <Badge>Open</Badge>}
            {task.status === "IN_PROGRESS" && <Badge variant="success">In Progress</Badge>}
        </div>
          {task.description && <p className="text-sm text-zinc-500 leading-relaxed">{task.description}</p>}
          {task.dueDate && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-500">
              <Clock3 size={13} />
              Due {new Date(task.dueDate).toLocaleDateString()}
            </p>
          )}
          {task.files && task.files.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Attachments</p>
              <div className="space-y-2">
                {task.files.map((file) => (
                  <FilePreview
                    key={file.id}
                    fileId={file.id}
                    type={file.type}
                    filename={file.name || file.originalName}
                    category={file.category}
                    canDelete={isAdmin}
                    onDelete={onDeleted}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {nextAction && (
          <Button
            type="button"
            variant={nextAction.variant}
            size="sm"
            className="gap-2"
            onClick={() => onStatusChange(task.id, nextAction.status)}
            aria-label={nextAction.ariaLabel}
          >
            <nextAction.Icon size={16} />
            {nextAction.label}
          </Button>
        )}
        {isAdmin && (
          <DeleteConfirmationButton
            endpoint={`/api/tasks/${task.id}`}
            label={`Delete ${task.title}`}
            title="Delete task"
            message={`Delete "${task.title}" from this job? This cannot be undone.`}
            onDeleted={onDeleted}
          />
        )}
      </div>
    </div>
  );
}

function getNextTaskAction(task: TaskItem) {
  if (task.status === "OPEN") {
    return {
      status: "IN_PROGRESS" as const,
      label: "Start",
      ariaLabel: `Start ${task.title}`,
      variant: "secondary" as const,
      Icon: PlayCircle,
    };
  }

  if (task.status === "IN_PROGRESS") {
    return {
      status: "DONE" as const,
      label: "Done",
      ariaLabel: `Mark ${task.title} complete`,
      variant: "secondary" as const,
      Icon: CheckCircle2,
    };
  }

  return {
    status: "OPEN" as const,
    label: "Reopen",
    ariaLabel: `Reopen ${task.title}`,
    variant: "ghost" as const,
    Icon: RotateCcw,
  };
}

function DailyReportCard({
  report,
  files,
  isAdmin,
  onDeleted,
}: {
  report: NoteItem;
  files: FileItem[];
  isAdmin: boolean;
  onDeleted: () => void;
}) {
  const reportDate = formatDisplayDate(getReportDisplayDate(report));

  return (
    <article className="rounded-xl border border-zinc-800 bg-black/20 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-zinc-100">Daily Report</h3>
            {report.type === "PROGRESS" && <Badge variant="success">Legacy Progress</Badge>}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {reportDate} by {report.authorName}
          </p>
        </div>
        {isAdmin && (
          <DeleteConfirmationButton
            endpoint={`/api/notes/${report.id}`}
            label={`Delete daily report from ${reportDate}`}
            title="Delete daily report"
            message="Delete this daily report from the job? This cannot be undone."
            onDeleted={onDeleted}
          />
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Work Performed</p>
        <p className="mt-1 text-sm leading-relaxed text-zinc-300">{report.content}</p>
      </div>

      {report.materialsUsed && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Materials Used</p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-300">{report.materialsUsed}</p>
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Attachments</p>
          <div className="space-y-3">
            {files.map((file) => (
              <FilePreview
                key={file.id}
                fileId={file.id}
                type={file.type}
                filename={file.name || file.originalName}
                category={file.category}
                canDelete={isAdmin}
                onDelete={onDeleted}
              />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
