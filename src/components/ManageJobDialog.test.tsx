// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManageJobDialog } from "./ManageJobDialog";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}));

const job = {
  id: "job-1",
  title: "Kitchen Remodel",
  jobNumber: "J-10",
  poNumber: "PO-10",
  contractNumber: "C-10",
  customerName: "Taylor Home",
  address: "123 Main St",
  contactName: "Taylor",
  contactPhone: "555-0100",
  contactEmail: "taylor@example.com",
  description: "Existing notes",
  status: "ACTIVE" as const,
  priority: 3,
  targetCompletionDate: "2026-06-01T00:00:00.000Z",
};

describe("ManageJobDialog", () => {
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

  it("prefills existing job fields and submits a PATCH payload", async () => {
    const user = userEvent.setup();
    render(<ManageJobDialog job={job} isAdmin />);

    await user.click(screen.getByRole("button", { name: "Manage Job" }));
    expect((screen.getByLabelText("Job Title *") as HTMLInputElement).value).toBe("Kitchen Remodel");
    expect((screen.getByLabelText("Contract Number") as HTMLInputElement).value).toBe("C-10");
    expect((screen.getByLabelText("Contact Email") as HTMLInputElement).value).toBe("taylor@example.com");
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("ACTIVE");
    expect((screen.getByLabelText("Priority") as HTMLSelectElement).value).toBe("3");
    expect((screen.getByLabelText("Target Completion Date") as HTMLInputElement).value).toBe("2026-06-01");

    await user.clear(screen.getByLabelText("PO Number"));
    await user.type(screen.getByLabelText("PO Number"), "PO-20");
    await user.selectOptions(screen.getByLabelText("Status"), "FINAL_BILL_SUBMITTED");
    await user.selectOptions(screen.getByLabelText("Priority"), "4");
    await user.click(screen.getByRole("button", { name: "Save Job" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/jobs",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(options?.body))).toMatchObject({
      id: "job-1",
      poNumber: "PO-20",
      status: "FINAL_BILL_SUBMITTED",
      priority: 4,
      targetCompletionDate: "2026-06-01",
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows API errors without closing the modal", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Invalid priority" }),
    } as Response);
    render(<ManageJobDialog job={job} isAdmin />);

    await user.click(screen.getByRole("button", { name: "Manage Job" }));
    await user.click(screen.getByRole("button", { name: "Save Job" }));

    expect(await screen.findByText("Invalid priority")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Manage Job" })).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("omits management fields from member UI and PATCH payload", async () => {
    const user = userEvent.setup();
    render(<ManageJobDialog job={job} isAdmin={false} />);

    await user.click(screen.getByRole("button", { name: "Manage Job" }));
    expect(screen.queryByLabelText("Status")).toBeNull();
    expect(screen.queryByLabelText("Priority")).toBeNull();
    expect(screen.queryByLabelText("Target Completion Date")).toBeNull();

    await user.clear(screen.getByLabelText("PO Number"));
    await user.type(screen.getByLabelText("PO Number"), "PO-20");
    await user.click(screen.getByRole("button", { name: "Save Job" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/jobs",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const payload = JSON.parse(String(options?.body));
    expect(payload).toMatchObject({
      id: "job-1",
      poNumber: "PO-20",
    });
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("priority");
    expect(payload).not.toHaveProperty("targetCompletionDate");
  });
});
