export type OfflineQueueStatus = "PENDING" | "SYNCING" | "FAILED";

export type OfflineQueueKind = "NOTE_CREATE" | "TASK_CREATE" | "FILE_UPLOAD";

type OfflineQueueBase = {
  id: string;
  clientMutationId: string;
  createdAt: string;
  jobId: string | null;
  status: OfflineQueueStatus;
  attempts: number;
  lastError: string | null;
};

export type OfflineNoteQueueItem = OfflineQueueBase & {
  kind: "NOTE_CREATE";
  payload: {
    type: "GENERAL" | "PROGRESS";
    content: string;
    category: string | null;
    statusTag: string | null;
  };
};

export type OfflineTaskQueueItem = OfflineQueueBase & {
  kind: "TASK_CREATE";
  payload: {
    title: string;
    description: string;
    type: "TASK" | "PUNCH_LIST";
    dueDate: string;
  };
};

export type OfflineFileQueueItem = OfflineQueueBase & {
  kind: "FILE_UPLOAD";
  payload: {
    originalName: string;
    name: string;
    contentType: string;
    category: string;
    blob: Blob;
  };
};

export type OfflineQueueItem =
  | OfflineNoteQueueItem
  | OfflineTaskQueueItem
  | OfflineFileQueueItem;

export type QueueOfflineNoteInput = {
  jobId?: string | null;
  type: "GENERAL" | "PROGRESS";
  content: string;
  category?: string | null;
  statusTag?: string | null;
};

export type QueueOfflineTaskInput = {
  jobId: string;
  title: string;
  description?: string;
  type?: "TASK" | "PUNCH_LIST";
  dueDate?: string;
};

export type QueueOfflineFileInput = {
  jobId?: string | null;
  originalName: string;
  name?: string;
  contentType: string;
  category: string;
  blob: Blob;
};
