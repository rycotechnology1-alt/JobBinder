// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JobStatusCard } from "./JobStatusCard";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}));

const job = {
  id: "job-1",
  status: "ACTIVE",
  priority: 3,
  targetCompletionDate: "2026-06-01T00:00:00.000Z",
};

describe("JobStatusCard", () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "job-1" }),
      }),
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("shows editable status, priority, and target completion fields", () => {
    render(<JobStatusCard job={job} />);

    expect(screen.getByRole("heading", { name: "Project Status" })).toBeTruthy();
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("ACTIVE");
    expect((screen.getByLabelText("Priority") as HTMLSelectElement).value).toBe("3");
    expect((screen.getByLabelText("Target Completion") as HTMLInputElement).value).toBe("2026-06-01");
  });

  it("saves the three status fields without opening the full job manager", async () => {
    const user = userEvent.setup();
    render(<JobStatusCard job={job} />);

    await user.selectOptions(screen.getByLabelText("Status"), "DELAY");
    await user.selectOptions(screen.getByLabelText("Priority"), "4");
    await user.clear(screen.getByLabelText("Target Completion"));
    await user.type(screen.getByLabelText("Target Completion"), "2026-06-15");
    await user.click(screen.getByRole("button", { name: "Save Status" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/jobs",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(options?.body))).toEqual({
      id: "job-1",
      status: "DELAY",
      priority: 4,
      targetCompletionDate: "2026-06-15",
    });
    expect(refresh).toHaveBeenCalledOnce();
  });
});
