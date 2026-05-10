// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
});
