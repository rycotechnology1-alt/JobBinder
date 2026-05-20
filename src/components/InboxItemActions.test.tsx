// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InboxItemActions } from "./InboxItemActions";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}));

const jobs = [
  { id: "job-1", title: "Kitchen Remodel", customerName: "Taylor Home" },
  { id: "job-2", title: "Deck Repair", customerName: null },
];

describe("InboxItemActions", () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "note-1", jobId: "job-1" }),
      }),
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("opens a job picker and assigns a note to the selected job", async () => {
    const user = userEvent.setup();
    render(<InboxItemActions itemType="note" itemId="note-1" jobs={jobs} />);

    await user.click(screen.getByRole("button", { name: "Assign to Job" }));
    expect(screen.getByRole("dialog", { name: "Assign to Job" })).toBeTruthy();
    expect(screen.getByLabelText("Kitchen Remodel")).toBeTruthy();

    await user.click(screen.getByLabelText("Kitchen Remodel"));
    await user.click(screen.getByRole("button", { name: "Assign" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/notes",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ id: "note-1", jobId: "job-1" }),
        }),
      );
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("opens file previews and assigns files through the file API", async () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessUrl: "https://files.example.com/file-1.pdf" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "file-1", jobId: "job-2" }),
      } as Response);
    const user = userEvent.setup();
    render(<InboxItemActions itemType="file" itemId="file-1" jobs={jobs} />);

    await user.click(screen.getByRole("button", { name: "View" }));
    await waitFor(() => {
      expect(open).toHaveBeenCalledWith("https://files.example.com/file-1.pdf", "_blank", "noopener,noreferrer");
    });

    await user.click(screen.getByRole("button", { name: "Assign to Job" }));
    await user.click(screen.getByLabelText("Deck Repair"));
    await user.click(screen.getByRole("button", { name: "Assign" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/files",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ id: "file-1", jobId: "job-2" }),
        }),
      );
    });
  });
});
