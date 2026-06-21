// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JobHeaderBar, type HeaderJob } from "./JobHeaderBar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock("@/components/JobActions", () => ({
  JobActions: () => <button type="button">New</button>,
}));

vi.mock("@/components/ManageJobDialog", () => ({
  ManageJobDialog: () => null,
}));

const job: HeaderJob = {
  id: "job-1",
  title: "Kitchen Remodel",
  status: "ACTIVE",
  priority: 3,
  targetCompletionDate: null,
  customerName: "Acme Home",
  address: "100 Main St",
  contactName: "Alex Customer",
  contactPhone: "555-0100",
  contactEmail: "alex@example.com",
  jobNumber: "J-100",
  poNumber: null,
  contractNumber: null,
  description: "Refresh the kitchen.",
};

describe("JobHeaderBar", () => {
  afterEach(() => {
    cleanup();
  });

  it("prioritizes the job title and hides status in the collapsed header", () => {
    render(<JobHeaderBar job={job} isAdmin={false} onOpenMobileNav={vi.fn()} />);

    const detailsButton = screen.getByRole("button", { name: "Show job details" });

    expect(detailsButton.textContent).toContain("Kitchen Remodel");
    expect(detailsButton.textContent).not.toContain("Work In Progress");
  });

  it("keeps project status available inside the expanded job details", async () => {
    const user = userEvent.setup();
    render(<JobHeaderBar job={job} isAdmin={false} onOpenMobileNav={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Show job details" }));

    expect(screen.getByText("Project Status")).toBeTruthy();
    expect(screen.getByText("Work In Progress")).toBeTruthy();
  });
});
