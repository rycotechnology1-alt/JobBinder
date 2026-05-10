export const TASK_STATUSES = ["OPEN", "IN_PROGRESS", "DONE"] as const;
export const TASK_TYPES = ["TASK", "PUNCH_LIST"] as const;

export type TaskStatusValue = (typeof TASK_STATUSES)[number];
export type TaskTypeValue = (typeof TASK_TYPES)[number];

export function normalizeFileDisplayName(name: unknown) {
  if (typeof name !== "string") return null;

  const trimmedName = name.trim();
  return trimmedName.length > 0 ? trimmedName : null;
}

export function isValidTaskStatus(status: unknown): status is TaskStatusValue {
  return typeof status === "string" && TASK_STATUSES.includes(status as TaskStatusValue);
}

export function isValidTaskType(type: unknown): type is TaskTypeValue {
  return typeof type === "string" && TASK_TYPES.includes(type as TaskTypeValue);
}

export function countIncompleteTasks<T extends { status: string }>(tasks: T[]) {
  return tasks.filter((task) => task.status !== "DONE").length;
}
