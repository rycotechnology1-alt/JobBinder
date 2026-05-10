// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JobActions } from "./JobActions";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}));

vi.mock("@/components/AssetUploadModal", () => ({
  AssetUploadModal: () => null,
}));

describe("JobActions", () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "created" }),
      }),
    );
  });

  afterEach(() => {
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
});
