// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JobSectionContent } from "./JobSectionContent";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}));

vi.mock("@/components/FilePreview", () => ({
  FilePreview: ({
    filename,
    category,
    canDelete,
    onDelete,
  }: {
    filename: string;
    category?: string | null;
    canDelete?: boolean;
    onDelete?: () => void;
  }) => (
    <div>
      <span>{filename}</span>
      {category && <span>{category}</span>}
      {canDelete && <button type="button" onClick={onDelete}>Delete {filename}</button>}
    </div>
  ),
}));

// FileViewerOverlay pulls in heavy PDF/image viewers; the Photos grid only needs its trigger.
vi.mock("@/components/FileViewerOverlay", () => ({
  FileViewerOverlay: () => null,
}));

const files = [
  {
    id: "file-1",
    type: "DOCUMENT" as const,
    originalName: "permit.pdf",
    name: "Permit Packet",
    category: "Permits",
    noteId: null,
    createdAt: "2026-05-09T12:00:00.000Z",
  },
  {
    id: "file-2",
    type: "PHOTO" as const,
    originalName: "before.jpg",
    name: null,
    category: "Before",
    noteId: null,
    createdAt: "2026-05-08T12:00:00.000Z",
  },
];

const dailyReports = [
  {
    id: "report-1",
    type: "DAILY_REPORT" as const,
    content: "Installed conduit and cleaned work area.",
    category: null,
    statusTag: null,
    reportDate: "2026-06-14T00:00:00.000Z",
    materialsUsed: "2 EMT sticks",
    createdAt: "2026-06-14T16:00:00.000Z",
    authorName: "Foreman",
  },
];

const dailyReportFiles = [
  {
    id: "file-report-1",
    type: "PHOTO" as const,
    originalName: "report-photo.jpg",
    name: null,
    category: "Misc",
    noteId: "report-1",
    createdAt: "2026-06-14T16:05:00.000Z",
  },
];

const tasks = [
  {
    id: "task-1",
    title: "Install trim",
    description: "Finish the north wall.",
    status: "OPEN" as const,
    type: "TASK" as const,
    priority: null,
    dueDate: null,
    createdAt: "2026-05-09T12:00:00.000Z",
  },
  {
    id: "task-2",
    title: "Finish caulk line",
    description: null,
    status: "IN_PROGRESS" as const,
    type: "PUNCH_LIST" as const,
    priority: null,
    dueDate: null,
    createdAt: "2026-05-08T12:00:00.000Z",
  },
  {
    id: "task-3",
    title: "Submit permit closeout",
    description: null,
    status: "DONE" as const,
    type: "PUNCH_LIST" as const,
    priority: null,
    dueDate: null,
    createdAt: "2026-05-08T12:00:00.000Z",
  },
];

describe("JobSectionContent", () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "task-1", status: "IN_PROGRESS" }),
      }),
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("shows only documents in the Files section and filters by category", async () => {
    const user = userEvent.setup();
    render(<JobSectionContent activeSection="FILES" notes={[]} files={files} tasks={tasks} isAdmin={false} />);

    expect(screen.getByRole("button", { name: "All (1)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Permits (1)" })).toBeTruthy();
    expect(screen.getByText("Permit Packet")).toBeTruthy();
    // The photo never appears in Files.
    expect(screen.queryByText("before.jpg")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Permits (1)" }));
    expect(screen.getByText("Permit Packet")).toBeTruthy();
  });

  it("shows only photos in the Photos section", () => {
    render(<JobSectionContent activeSection="PHOTOS" notes={[]} files={files} tasks={tasks} isAdmin={false} />);

    expect(screen.getByRole("button", { name: "All (1)" })).toBeTruthy();
    expect(screen.getByAltText("before.jpg")).toBeTruthy();
    // The document never appears in Photos.
    expect(screen.queryByText("Permit Packet")).toBeNull();
  });

  it("separates tasks from punch list items and progresses statuses optimistically", async () => {
    const user = userEvent.setup();
    render(<JobSectionContent activeSection="TASKS" notes={[]} files={files} tasks={tasks} isAdmin={false} />);

    expect(screen.getByRole("heading", { name: "Tasks" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Punch List" })).toBeTruthy();

    const tasksSection = screen.getByTestId("tasks-section");
    const punchListSection = screen.getByTestId("punch-list-section");
    expect(within(tasksSection).getByText("Install trim")).toBeTruthy();
    expect(within(punchListSection).getByText("Finish caulk line")).toBeTruthy();
    expect(within(punchListSection).getByText("Submit permit closeout")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Start Install trim" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Mark Install trim complete" })).toBeTruthy();
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/tasks",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ id: "task-1", status: "IN_PROGRESS" }),
      }),
    );

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "task-1", status: "DONE" }),
    } as Response);

    await user.click(screen.getByRole("button", { name: "Mark Install trim complete" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Reopen Install trim" })).toBeTruthy();
    });

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "task-3", status: "OPEN" }),
    } as Response);

    await user.click(screen.getByRole("button", { name: "Reopen Submit permit closeout" }));
    await waitFor(() => {
      expect(fetch).toHaveBeenLastCalledWith(
        "/api/tasks",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ id: "task-3", status: "OPEN" }),
        }),
      );
    });
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("shows delete controls only for admins and confirms task deletion", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <JobSectionContent activeSection="TASKS" notes={[]} files={files} tasks={tasks} isAdmin={false} />,
    );

    expect(screen.queryByRole("button", { name: "Delete Install trim" })).toBeNull();

    rerender(<JobSectionContent activeSection="TASKS" notes={[]} files={files} tasks={tasks} isAdmin />);
    await user.click(screen.getByRole("button", { name: "Delete Install trim" }));
    expect(screen.getByRole("dialog", { name: "Delete task" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/tasks/task-1", expect.objectContaining({ method: "DELETE" }));
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("reflects newly refreshed task props without a full page reload", () => {
    const newTask = {
      id: "task-3",
      title: "Call inspector",
      description: null,
      status: "OPEN" as const,
      type: "TASK" as const,
      priority: null,
      dueDate: null,
      createdAt: "2026-05-10T12:00:00.000Z",
    };
    const { rerender } = render(
      <JobSectionContent activeSection="TASKS" notes={[]} files={[]} tasks={[]} isAdmin={false} />,
    );

    expect(screen.queryByText("Call inspector")).toBeNull();

    rerender(<JobSectionContent activeSection="TASKS" notes={[]} files={[]} tasks={[newTask]} isAdmin={false} />);

    expect(screen.getByText("Call inspector")).toBeTruthy();
  });

  it("shows daily reports with report metadata and linked attachments", () => {
    render(
      <JobSectionContent
        activeSection="DAILY_REPORTS"
        notes={dailyReports}
        files={dailyReportFiles}
        tasks={[]}
        isAdmin={false}
      />,
    );

    expect(screen.getByText("Installed conduit and cleaned work area.")).toBeTruthy();
    expect(screen.getByText("2 EMT sticks")).toBeTruthy();
    expect(screen.getByText(/by Foreman/)).toBeTruthy();
    expect(screen.getByText("report-photo.jpg")).toBeTruthy();
  });

  it("shows task attachments on task rows", () => {
    render(
      <JobSectionContent
        activeSection="TASKS"
        notes={[]}
        files={[]}
        tasks={[
          {
            id: "task-with-file",
            title: "Fix sill caulk",
            description: null,
            status: "OPEN",
            type: "TASK",
            priority: null,
            dueDate: null,
            createdAt: "2026-06-15T12:00:00.000Z",
            files: [
              {
                id: "file-task-1",
                type: "PHOTO",
                originalName: "sill.jpg",
                name: null,
                category: "Issue",
                noteId: null,
                taskId: "task-with-file",
                markupMarkId: null,
                createdAt: "2026-06-15T12:05:00.000Z",
              },
            ],
          },
        ]}
        isAdmin={false}
      />,
    );

    expect(screen.getByText("Fix sill caulk")).toBeTruthy();
    expect(screen.getByText("sill.jpg")).toBeTruthy();
  });

  it("keeps linked photos out of the feed but aggregates them in Photos", () => {
    const photoFiles = [
      {
        id: "file-standalone",
        type: "PHOTO" as const,
        originalName: "overview.jpg",
        name: null,
        category: "Before",
        noteId: null,
        taskId: null,
        markupMarkId: null,
        createdAt: "2026-06-15T12:00:00.000Z",
      },
      {
        id: "file-pin",
        type: "PHOTO" as const,
        originalName: "pin-photo.jpg",
        name: null,
        category: "Issue",
        noteId: null,
        taskId: null,
        markupMarkId: "mark-1",
        createdAt: "2026-06-15T12:05:00.000Z",
      },
    ];

    const { rerender } = render(
      <JobSectionContent activeSection="FEED" notes={[]} files={photoFiles} tasks={[]} isAdmin={false} />,
    );

    // The feed shows the standalone upload but not the pin-attached photo.
    expect(screen.getByText("overview.jpg")).toBeTruthy();
    expect(screen.queryByText("pin-photo.jpg")).toBeNull();

    // The Photos section aggregates every photo, including pin attachments.
    rerender(<JobSectionContent activeSection="PHOTOS" notes={[]} files={photoFiles} tasks={[]} isAdmin={false} />);
    expect(screen.getByAltText("overview.jpg")).toBeTruthy();
    expect(screen.getByAltText("pin-photo.jpg")).toBeTruthy();
  });
});
