// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { JobOverviewCard } from "./JobOverviewCard";

const job = {
  customerName: "Test Customer",
  address: "5 Butternut Avenue",
  contactName: "Sam",
  contactPhone: "555-0100",
  contactEmail: "sam@example.com",
  jobNumber: "J-10",
  poNumber: "PO-10",
  contractNumber: "C-10",
  description: "Existing details",
};

describe("JobOverviewCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("starts collapsed and expands job details on request", async () => {
    const user = userEvent.setup();
    render(<JobOverviewCard job={job} />);

    expect(screen.getByRole("button", { name: "Overview" })).toBeTruthy();
    expect(screen.queryByText("Test Customer")).toBeNull();
    expect(screen.queryByText("Target Completion")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Overview" }));

    expect(screen.getByText("Test Customer")).toBeTruthy();
    expect(screen.getByText("5 Butternut Avenue")).toBeTruthy();
    expect(screen.queryByText("Target Completion")).toBeNull();
  });
});
