// Shared types for the file markup feature.
//
// All mark geometry is stored in NORMALIZED coordinates (0..1 of the page
// width/height). This keeps marks independent of the render scale: they map
// cleanly onto the SVG overlay at any zoom and into the flattened PDF's
// pdf.js-compatible display viewport.

export type MarkKind = "PEN" | "ELLIPSE" | "ARROW" | "CLOUD" | "PIN";

/** The active editing tool. "select" moves/selects existing marks. */
export type MarkupTool = "select" | "pen" | "ellipse" | "arrow" | "cloud" | "pin";

/** Map an editing tool to the mark kind it produces (null for "select"). */
export function toolToKind(tool: MarkupTool): MarkKind | null {
  return tool === "select" ? null : (tool.toUpperCase() as MarkKind);
}

/** A point in normalized page space — both components in [0, 1]. */
export type NormalizedPoint = { x: number; y: number };

/** A normalized axis-aligned box — origin (x,y) plus width/height, all in [0, 1]. */
export type NormalizedBox = { x: number; y: number; w: number; h: number };

export type MarkStyle = {
  /** CSS color string, e.g. "#ef4444". */
  color: string;
  /** Stroke width as a fraction of the page's smaller dimension (resolution independent). */
  strokeWidth: number;
  /** 0..1 */
  opacity: number;
};

export type MarkAttachment = {
  id: string;
  type: "PHOTO" | "DOCUMENT";
  originalName: string;
  name: string | null;
  category: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: string;
};

export type MarkTaskLink = {
  id: string;
  title: string;
  status: "OPEN" | "IN_PROGRESS" | "DONE";
  type: "TASK" | "PUNCH_LIST";
  dueDate: string | null;
};

type MarkBase = {
  id: string;
  fileId: string;
  /** 1-based page number; images are always page 1. */
  page: number;
  style: MarkStyle;
  /** Creation order, used to number pins. */
  sequence: number;
  authorId?: string;
  /** Optional text comment. Used by pins today; available to any mark. */
  text?: string | null;
  /** ISO timestamp; null/undefined means not deleted. */
  deletedAt?: string | null;
  /** ISO timestamp set by the client — drives per-mark last-write-wins merge. */
  clientUpdatedAt: string;
  /** Server-owned files attached to this mark. Ignored in markup mutations. */
  attachments?: MarkAttachment[];
  /** Server-owned task created from this pin. Ignored in markup mutations. */
  task?: MarkTaskLink | null;
};

export type PenMark = MarkBase & {
  kind: "PEN";
  geometry: { points: NormalizedPoint[] };
};

export type EllipseMark = MarkBase & {
  kind: "ELLIPSE";
  geometry: NormalizedBox;
};

export type CloudMark = MarkBase & {
  kind: "CLOUD";
  geometry: NormalizedBox;
};

export type ArrowMark = MarkBase & {
  kind: "ARROW";
  geometry: { x1: number; y1: number; x2: number; y2: number };
};

export type PinMark = MarkBase & {
  kind: "PIN";
  geometry: NormalizedPoint;
};

export type Mark = PenMark | EllipseMark | CloudMark | ArrowMark | PinMark;

/**
 * A change the client wants to persist. Upserts carry the full mark; deletes
 * carry only the id + timestamp so they merge across offline clients.
 */
export type MarkMutation =
  | { op: "upsert"; mark: Mark }
  | { op: "delete"; id: string; clientUpdatedAt: string };
