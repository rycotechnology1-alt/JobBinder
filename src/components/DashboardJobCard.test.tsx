// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DashboardJobCard } from "./DashboardJobCard";

describe("DashboardJobCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders roadmap status, critical flag, target date, and progress display", () => {
    render(
      <DashboardJobCard
        job={{
          id: "job-1",
          title: "Closeout Job",
          customerName: "Acme",
          address: "10 Main St",
          jobNumber: "J-10",
          poNumber: "PO-10",
          contractNumber: "C-10",
          status: "FINAL_BILL_SUBMITTED",
          priority: 4,
          targetCompletionDate: "2026-05-20T00:00:00.000Z",
          createdAt: "2026-05-10T00:00:00.000Z",
        }}
        now={new Date("2026-05-17T12:00:00.000Z")}
      />,
    );

    const link = screen.getByRole("link", { name: /Closeout Job/i });
    expect(link.getAttribute("href")).toBe("/jobs/job-1");
    expect(screen.getByText("Final Bill Submitted")).toBeTruthy();
    expect(screen.getAllByText("Critical").length).toBeGreaterThan(0);
    expect(screen.getByText("75%")).toBeTruthy();
    expect(screen.getByText("3 days left")).toBeTruthy();
    expect(screen.getByText("J-10 / PO-10 / C-10")).toBeTruthy();
  });

  it("renders a complete paid job with glowing status treatment", () => {
    render(
      <DashboardJobCard
        job={{
          id: "job-2",
          title: "Paid Job",
          customerName: null,
          address: null,
          jobNumber: null,
          poNumber: null,
          contractNumber: null,
          status: "COMPLETE",
          priority: 2,
          targetCompletionDate: null,
          createdAt: "2026-05-10T00:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByText("Complete Paid")).toBeTruthy();
    expect(screen.getByText("Medium")).toBeTruthy();
    expect(screen.queryByText(/%/)).toBeNull();
  });
});
