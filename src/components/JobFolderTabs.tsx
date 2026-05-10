"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Clock3 } from "lucide-react";
import { ASSET_CATEGORIES } from "@/lib/asset-categories";
import { countIncompleteTasks } from "@/lib/job-folder";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FilePreview } from "@/components/FilePreview";
import { JobFeed } from "@/components/JobFeed";

type NoteItem = {
  id: string;
  type: "GENERAL" | "PROGRESS";
  content: string;
  category: string | null;
  statusTag: string | null;
  createdAt: string;
  authorName: string;
};

type FileItem = {
  id: string;
  type: "PHOTO" | "DOCUMENT";
  originalName: string;
  name: string | null;
  category: string | null;
  createdAt: string;
};

type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: "OPEN" | "IN_PROGRESS" | "DONE";
  type: "TASK" | "PUNCH_LIST";
  priority: number | null;
  dueDate: string | null;
  createdAt: string;
};

type Tab = "FEED" | "FILES" | "TASKS";

type Props = {
  notes: NoteItem[];
  files: FileItem[];
  tasks: TaskItem[];
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

export function JobFolderTabs({ notes, files, tasks: initialTasks }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("FEED");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(() => new Set());
  const [taskError, setTaskError] = useState<string | null>(null);
  const router = useRouter();

  const tasks = useMemo(() => {
    return initialTasks.map((task) => (
      completedTaskIds.has(task.id) ? { ...task, status: "DONE" as const } : task
    ));
  }, [completedTaskIds, initialTasks]);

  const incompleteTaskCount = countIncompleteTasks(tasks);

  const fileCounts = useMemo(() => {
    return ASSET_CATEGORIES.reduce<Record<string, number>>((counts, category) => {
      counts[category] = files.filter((file) => file.category === category).length;
      return counts;
    }, {});
  }, [files]);

  const visibleFiles = selectedCategory === "All"
    ? files
    : files.filter((file) => file.category === selectedCategory);

  const sortedTasks = useMemo(() => sortTasks(tasks), [tasks]);
  const openTasks = sortedTasks.filter((task) => task.status !== "DONE");
  const completedTasks = sortedTasks.filter((task) => task.status === "DONE");

  async function completeTask(taskId: string) {
    setTaskError(null);
    setCompletedTaskIds((currentTaskIds) => new Set(currentTaskIds).add(taskId));

    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: "DONE" }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "Could not update task.");
      }

      router.refresh();
    } catch (error) {
      setCompletedTaskIds((currentTaskIds) => {
        const nextTaskIds = new Set(currentTaskIds);
        nextTaskIds.delete(taskId);
        return nextTaskIds;
      });
      setTaskError(error instanceof Error ? error.message : "Could not update task.");
    }
  }

  const tabClass = (tab: Tab) => cn(
    "px-6 py-4 text-sm font-medium border-b-2 transition-colors",
    activeTab === tab
      ? "text-brand border-brand"
      : "text-zinc-400 border-transparent hover:text-zinc-300",
  );

  return (
    <>
      <div className="flex border-b border-zinc-800 overflow-x-auto">
        <button type="button" className={tabClass("FEED")} onClick={() => setActiveTab("FEED")}>
          Feed
        </button>
        <button type="button" className={tabClass("FILES")} onClick={() => setActiveTab("FILES")}>
          Files ({files.length})
        </button>
        <button type="button" className={tabClass("TASKS")} onClick={() => setActiveTab("TASKS")}>
          Tasks ({incompleteTaskCount})
        </button>
      </div>

      <div className="p-6">
        {activeTab === "FEED" && <JobFeed notes={notes} files={files} />}

        {activeTab === "FILES" && (
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
                All ({files.length})
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
                  {category} ({fileCounts[category] ?? 0})
                </button>
              ))}
            </div>

            {visibleFiles.length === 0 ? (
              <p className="text-zinc-500 text-center py-10">No files in this category yet.</p>
            ) : (
              <div className="space-y-4">
                {visibleFiles.map((file) => (
                  <FilePreview
                    key={file.id}
                    fileId={file.id}
                    type={file.type}
                    filename={file.name || file.originalName}
                    category={file.category}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "TASKS" && (
          <div className="space-y-8">
            {taskError && <p className="text-sm text-red-400">{taskError}</p>}

            <section data-testid="open-tasks" className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-zinc-100">Open Tasks</h3>
                <Badge variant="brand">{openTasks.length}</Badge>
              </div>
              {openTasks.length === 0 ? (
                <p className="text-zinc-500 text-center py-8">No open tasks.</p>
              ) : (
                openTasks.map((task) => (
                  <TaskRow key={task.id} task={task} onComplete={completeTask} />
                ))
              )}
            </section>

            <section data-testid="completed-tasks" className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-zinc-100">Completed</h3>
                <Badge>{completedTasks.length}</Badge>
              </div>
              {completedTasks.length === 0 ? (
                <p className="text-zinc-500 text-center py-8">No completed tasks yet.</p>
              ) : (
                completedTasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}

function TaskRow({
  task,
  onComplete,
}: {
  task: TaskItem;
  onComplete?: (taskId: string) => void;
}) {
  const isDone = task.status === "DONE";

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
            {task.status === "IN_PROGRESS" && <Badge variant="success">In Progress</Badge>}
          </div>
          {task.description && <p className="text-sm text-zinc-500 leading-relaxed">{task.description}</p>}
          {task.dueDate && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-500">
              <Clock3 size={13} />
              Due {new Date(task.dueDate).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
      {!isDone && onComplete && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0 gap-2"
          onClick={() => onComplete(task.id)}
          aria-label={`Mark ${task.title} complete`}
        >
          <CheckCircle2 size={16} />
          Done
        </Button>
      )}
    </div>
  );
}
