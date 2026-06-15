// Server-side (de)serialization and validation for markup marks. Pure
// functions so they can be unit-tested without a database.

import type { Mark, MarkAttachment, MarkKind, MarkMutation, MarkStyle, MarkTaskLink } from "./types";

export const MARK_KINDS: MarkKind[] = ["PEN", "ELLIPSE", "ARROW", "CLOUD", "PIN"];

/** Shape of a FileMarkupMark row as read from Prisma. */
export type DbMarkRow = {
  id: string;
  fileId: string;
  page: number;
  kind: string;
  geometry: unknown;
  style: unknown;
  text: string | null;
  sequence: number;
  authorId: string;
  deletedAt: Date | null;
  clientUpdatedAt: Date;
};

export type DbMarkAttachmentRow = {
  id: string;
  type: "PHOTO" | "DOCUMENT";
  originalName: string;
  name: string | null;
  category: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: Date;
};

export type DbMarkTaskRow = {
  id: string;
  title: string;
  status: "OPEN" | "IN_PROGRESS" | "DONE";
  type: "TASK" | "PUNCH_LIST";
  dueDate: Date | null;
};

type MarkServerMetadata = {
  attachments?: DbMarkAttachmentRow[];
  task?: DbMarkTaskRow | null;
};

export function serializeMark(row: DbMarkRow, metadata: MarkServerMetadata = {}): Mark {
  return {
    id: row.id,
    fileId: row.fileId,
    page: row.page,
    kind: row.kind as MarkKind,
    geometry: row.geometry,
    style: row.style as MarkStyle,
    text: row.text,
    sequence: row.sequence,
    authorId: row.authorId,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    clientUpdatedAt: row.clientUpdatedAt.toISOString(),
    ...(metadata.attachments ? { attachments: metadata.attachments.map(serializeAttachment) } : {}),
    ...(metadata.task !== undefined ? { task: metadata.task ? serializeTask(metadata.task) : null } : {}),
  } as Mark;
}

function serializeAttachment(row: DbMarkAttachmentRow): MarkAttachment {
  return {
    id: row.id,
    type: row.type,
    originalName: row.originalName,
    name: row.name,
    category: row.category,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeTask(row: DbMarkTaskRow): MarkTaskLink {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    type: row.type,
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
  };
}

type ParseResult = { ok: true; mutations: MarkMutation[] } | { ok: false; error: string };

const MAX_MUTATIONS = 500;

export function parseMarkMutations(body: unknown): ParseResult {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid request body" };
  const raw = (body as { mutations?: unknown }).mutations;
  if (!Array.isArray(raw)) return { ok: false, error: "mutations must be an array" };
  if (raw.length === 0) return { ok: false, error: "mutations must not be empty" };
  if (raw.length > MAX_MUTATIONS) return { ok: false, error: "too many mutations in one request" };

  const mutations: MarkMutation[] = [];
  for (const item of raw) {
    const parsed = parseOne(item);
    if (!parsed.ok) return parsed;
    mutations.push(parsed.mutation);
  }
  return { ok: true, mutations };
}

type ParseOne = { ok: true; mutation: MarkMutation } | { ok: false; error: string };

function parseOne(item: unknown): ParseOne {
  if (!item || typeof item !== "object") return { ok: false, error: "Invalid mutation" };
  const op = (item as { op?: unknown }).op;

  if (op === "delete") {
    const id = (item as { id?: unknown }).id;
    const clientUpdatedAt = (item as { clientUpdatedAt?: unknown }).clientUpdatedAt;
    if (!isNonEmptyString(id)) return { ok: false, error: "delete requires an id" };
    if (!isIsoDate(clientUpdatedAt)) return { ok: false, error: "delete requires clientUpdatedAt" };
    return { ok: true, mutation: { op: "delete", id, clientUpdatedAt } };
  }

  if (op === "upsert") {
    const mark = parseMark((item as { mark?: unknown }).mark);
    if (!mark.ok) return mark;
    return { ok: true, mutation: { op: "upsert", mark: mark.mark } };
  }

  return { ok: false, error: "mutation op must be 'upsert' or 'delete'" };
}

type ParseMark = { ok: true; mark: Mark } | { ok: false; error: string };

function parseMark(value: unknown): ParseMark {
  if (!value || typeof value !== "object") return { ok: false, error: "Invalid mark" };
  const m = value as Record<string, unknown>;

  if (!isNonEmptyString(m.id)) return { ok: false, error: "mark.id is required" };
  if (!MARK_KINDS.includes(m.kind as MarkKind)) return { ok: false, error: "mark.kind is invalid" };
  if (!isPositiveInt(m.page)) return { ok: false, error: "mark.page must be a positive integer" };
  if (!m.geometry || typeof m.geometry !== "object") return { ok: false, error: "mark.geometry is required" };
  const style = parseStyle(m.style);
  if (!style) return { ok: false, error: "mark.style is invalid" };
  if (!isIsoDate(m.clientUpdatedAt)) return { ok: false, error: "mark.clientUpdatedAt is required" };
  if (m.text != null && typeof m.text !== "string") return { ok: false, error: "mark.text must be a string" };

  // Trusted fields (fileId, authorId, companyId) are assigned by the server,
  // never taken from the client, so we ignore any client-supplied values here.
  const mark = {
    id: m.id,
    fileId: "",
    page: m.page,
    kind: m.kind,
    geometry: m.geometry,
    style,
    text: typeof m.text === "string" ? m.text : null,
    sequence: isFiniteNumber(m.sequence) ? m.sequence : 0,
    clientUpdatedAt: m.clientUpdatedAt,
  } as Mark;
  return { ok: true, mark };
}

function parseStyle(value: unknown): MarkStyle | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Record<string, unknown>;
  if (!isNonEmptyString(s.color)) return null;
  if (!isFiniteNumber(s.strokeWidth)) return null;
  if (!isFiniteNumber(s.opacity)) return null;
  return { color: s.color, strokeWidth: s.strokeWidth, opacity: s.opacity };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}
