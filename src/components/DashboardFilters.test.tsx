// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardFilters } from "./DashboardFilters";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    replace,
  }),
}));

describe("DashboardFilters", () => {
  beforeEach(() => {
    replace.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the current search and grouped status filter", () => {
    render(<DashboardFilters currentSearch="PO-42" currentStatus="active" />);

    expect((screen.getByRole("searchbox", { name: "Search jobs" }) as HTMLInputElement).value).toBe("PO-42");
    expect(screen.getByRole("button", { name: "Active" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Delay" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("submits search text into the dashboard URL while preserving status", async () => {
    const user = userEvent.setup();
    render(<DashboardFilters currentSearch="" currentStatus="delay" />);

    await user.type(screen.getByRole("searchbox", { name: "Search jobs" }), "Acme");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(replace).toHaveBeenCalledWith("/?search=Acme&status=delay", { scroll: false });
  });

  it("updates the grouped status filter in the dashboard URL while preserving search", async () => {
    const user = userEvent.setup();
    render(<DashboardFilters currentSearch="job-10" currentStatus="all" />);

    await user.click(screen.getByRole("button", { name: "Complete" }));

    expect(replace).toHaveBeenCalledWith("/?search=job-10&status=complete", { scroll: false });
  });

  it("clears filters back to the dashboard root URL", async () => {
    const user = userEvent.setup();
    render(<DashboardFilters currentSearch="Acme" currentStatus="active" />);

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(replace).toHaveBeenCalledWith("/", { scroll: false });
  });
});
