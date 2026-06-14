// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JobActions } from "./JobActions";

const refresh = vi.fn();
const push = vi.fn();
const offlineQueueMocks = vi.hoisted(() => ({
  queueOfflineNote: vi.fn(),
  queueOfflineTask: vi.fn(),
  queueOfflineDailyReport: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
    push,
  }),
}));

vi.mock("@/components/AssetUploadModal", () => ({
  AssetUploadModal: () => null,
}));

vi.mock("@/lib/offline-sync/queue", () => ({
  queueOfflineNote: offlineQueueMocks.queueOfflineNote,
  queueOfflineTask: offlineQueueMocks.queueOfflineTask,
  queueOfflineDailyReport: offlineQueueMocks.queueOfflineDailyReport,
}));

describe("JobActions", () => {
  beforeEach(() => {
    refresh.mockClear();
    push.mockClear();
    offlineQueueMocks.queueOfflineNote.mockReset();
    offlineQueueMocks.queueOfflineTask.mockReset();
    offlineQueueMocks.queueOfflineDailyReport.mockReset();
    offlineQueueMocks.queueOfflineNote.mockResolvedValue({ id: "queued-note" });
    offlineQueueMocks.queueOfflineTask.mockResolvedValue({ id: "queued-task" });
    offlineQueueMocks.queueOfflineDailyReport.mockResolvedValue({ id: "queued-report" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "created" }),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("can create a note and a related task from the Add Note modal", async () => {
    const user = userEvent.setup();
    render(<JobActions jobId="job-1" />);

    await user.click(screen.getByRole("button", { name: /Add Note/i }));
    await user.type(screen.getByLabelText("Note Details *"), "Customer asked for a closeout checklist.");
    await user.click(screen.getByLabelText("Create task from this note"));
    await user.type(screen.getByLabelText("Task Title *"), "Build closeout checklist");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "/api/notes",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Customer asked for a closeout checklist."),
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/tasks",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Build closeout checklist"),
      }),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("quick-adds a task with description and due date", async () => {
    const user = userEvent.setup();
    render(<JobActions jobId="job-1" />);

    await user.click(screen.getByRole("button", { name: /Quick Task/i }));
    await user.type(screen.getByLabelText("Title *"), "Install cabinet pulls");
    await user.type(screen.getByLabelText("Description"), "Use brushed nickel hardware.");
    await user.type(screen.getByLabelText("Due Date"), "2026-06-15");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/tasks",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            jobId: "job-1",
            title: "Install cabinet pulls",
            description: "Use brushed nickel hardware.",
            type: "TASK",
            dueDate: "2026-06-15",
          }),
        }),
      );
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("quick-adds a punch list item", async () => {
    const user = userEvent.setup();
    render(<JobActions jobId="job-1" />);

    await user.click(screen.getByRole("button", { name: /Quick Task/i }));
    await user.type(screen.getByLabelText("Title *"), "Touch up stair trim");
    await user.click(screen.getByLabelText("Punch List"));
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/tasks",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            jobId: "job-1",
            title: "Touch up stair trim",
            description: "",
            type: "PUNCH_LIST",
            dueDate: "",
          }),
        }),
      );
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("requires a quick-add title and shows API errors", async () => {
    const user = userEvent.setup();
    render(<JobActions jobId="job-1" />);

    await user.click(screen.getByRole("button", { name: /Quick Task/i }));
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Task title is required.")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Could not create task." }),
    } as Response);

    await user.type(screen.getByLabelText("Title *"), "Call customer");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Could not create task.")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("queues daily reports with multiple attachments while offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const user = userEvent.setup();
    render(<JobActions jobId="job-1" />);

    await user.click(screen.getAllByRole("button", { name: /Daily Report/i })[0]);
    expect(screen.queryByLabelText("Category")).toBeNull();

    await user.clear(screen.getByLabelText("Report Date *"));
    await user.type(screen.getByLabelText("Report Date *"), "2026-06-14");
    await user.type(screen.getByLabelText("Work Performed *"), "Installed conduit.");
    await user.type(screen.getByLabelText("Materials Used"), "2 EMT sticks");

    const fileInput = screen.getByLabelText("Attach files or photos") as HTMLInputElement;
    const firstFile = new File(["photo-1"], "photo-1.jpg", { type: "image/jpeg" });
    const secondFile = new File(["receipt"], "receipt.pdf", { type: "application/pdf" });
    Object.defineProperty(fileInput, "files", {
      value: [firstFile, secondFile],
      configurable: true,
    });
    fireEvent.change(fileInput);

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(offlineQueueMocks.queueOfflineDailyReport).toHaveBeenCalledWith({
        jobId: "job-1",
        reportDate: "2026-06-14",
        workPerformed: "Installed conduit.",
        materialsUsed: "2 EMT sticks",
        attachments: [
          {
            originalName: "photo-1.jpg",
            name: "",
            contentType: "image/jpeg",
            blob: firstFile,
          },
          {
            originalName: "receipt.pdf",
            name: "",
            contentType: "application/pdf",
            blob: secondFile,
          },
        ],
      });
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByText("Installed conduit.")).toBeNull();
  });

  it("queues quick tasks while offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const user = userEvent.setup();
    render(<JobActions jobId="job-1" />);

    await user.click(screen.getByRole("button", { name: /Quick Task/i }));
    await user.type(screen.getByLabelText("Title *"), "Call inspector");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(offlineQueueMocks.queueOfflineTask).toHaveBeenCalledWith({
        jobId: "job-1",
        title: "Call inspector",
        description: "",
        type: "TASK",
        dueDate: "",
      });
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows whole-job delete only for admins and redirects after confirmation", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<JobActions jobId="job-1" isAdmin={false} />);

    expect(screen.queryByRole("button", { name: "Delete job" })).toBeNull();

    rerender(<JobActions jobId="job-1" isAdmin />);
    expect(screen.queryByText("Delete Job")).toBeNull();
    await user.click(screen.getAllByRole("button", { name: "Delete job" })[0]);
    expect(screen.getByRole("dialog", { name: "Delete job" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/jobs/job-1", expect.objectContaining({ method: "DELETE" }));
    });
    expect(push).toHaveBeenCalledWith("/");
    expect(refresh).toHaveBeenCalled();
  });
});
