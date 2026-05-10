// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JobFolderTabs } from "./JobFolderTabs";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}));

vi.mock("@/components/FilePreview", () => ({
  FilePreview: ({ filename, category }: { filename: string; category?: string | null }) => (
    <div>
      <span>{filename}</span>
      {category && <span>{category}</span>}
    </div>
  ),
}));

const files = [
  {
    id: "file-1",
    type: "DOCUMENT" as const,
    originalName: "permit.pdf",
    name: "Permit Packet",
    category: "Permits",
    createdAt: "2026-05-09T12:00:00.000Z",
  },
  {
    id: "file-2",
    type: "PHOTO" as const,
    originalName: "before.jpg",
    name: null,
    category: "Before",
    createdAt: "2026-05-08T12:00:00.000Z",
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

describe("JobFolderTabs", () => {
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

  it("switches to files and filters by category", async () => {
    const user = userEvent.setup();
    render(<JobFolderTabs notes={[]} files={files} tasks={tasks} />);

    expect(screen.getByRole("button", { name: "Files (2)" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Files (2)" }));

    expect(screen.getByRole("button", { name: "Permits (1)" })).toBeTruthy();
    expect(screen.getByText("Permit Packet")).toBeTruthy();
    expect(screen.getByText("before.jpg")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Permits (1)" }));

    expect(screen.getByText("Permit Packet")).toBeTruthy();
    expect(screen.queryByText("before.jpg")).toBeNull();
  });

  it("separates tasks from punch list items and progresses statuses optimistically", async () => {
    const user = userEvent.setup();
    render(<JobFolderTabs notes={[]} files={files} tasks={tasks} />);

    await user.click(screen.getByRole("button", { name: "Tasks (2)" }));
    expect(screen.getByRole("heading", { name: "Tasks" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Punch List" })).toBeTruthy();

    const tasksSection = screen.getByTestId("tasks-section");
    const punchListSection = screen.getByTestId("punch-list-section");
    expect(within(tasksSection).getByText("Install trim")).toBeTruthy();
    expect(within(punchListSection).getByText("Finish caulk line")).toBeTruthy();
    expect(within(punchListSection).getByText("Submit permit closeout")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Start Install trim" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Tasks (2)" })).toBeTruthy();
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
      expect(screen.getByRole("button", { name: "Tasks (1)" })).toBeTruthy();
    });

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "task-3", status: "OPEN" }),
    } as Response);

    await user.click(screen.getByRole("button", { name: "Reopen Submit permit closeout" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Tasks (2)" })).toBeTruthy();
    });
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/tasks",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ id: "task-3", status: "OPEN" }),
      }),
    );
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("reflects newly refreshed task props without a full page reload", async () => {
    const user = userEvent.setup();
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
    const { rerender } = render(<JobFolderTabs notes={[]} files={[]} tasks={[]} />);

    expect(screen.getByRole("button", { name: "Tasks (0)" })).toBeTruthy();

    rerender(<JobFolderTabs notes={[]} files={[]} tasks={[newTask]} />);

    expect(screen.getByRole("button", { name: "Tasks (1)" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Tasks (1)" }));
    expect(screen.getByText("Call inspector")).toBeTruthy();
  });
});
