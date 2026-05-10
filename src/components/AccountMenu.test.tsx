// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountMenu } from "./AccountMenu";

describe("AccountMenu", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens account details from the avatar without signing out", async () => {
    const user = userEvent.setup();
    const signOutAction = vi.fn();
    render(
      <AccountMenu
        displayName="Sam Builder"
        email="sam@example.com"
        hasCompany
        signOutAction={signOutAction}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open account menu for Sam Builder" }));

    expect(signOutAction).not.toHaveBeenCalled();
    expect(screen.getByText("Sam Builder")).toBeTruthy();
    expect(screen.getByText("sam@example.com")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Team Settings" }).getAttribute("href")).toBe("/settings/team");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("toggles and dismisses the account menu", async () => {
    const user = userEvent.setup();
    render(
      <AccountMenu
        displayName="Taylor"
        email={null}
        hasCompany={false}
        signOutAction={vi.fn()}
      />,
    );

    const avatar = screen.getByRole("button", { name: "Open account menu for Taylor" });
    expect(avatar.textContent).toBe("T");

    await user.click(avatar);
    expect(screen.getByText("Taylor")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Team Settings" })).toBeNull();

    await user.click(avatar);
    expect(screen.queryByText("Taylor")).toBeNull();

    await user.click(avatar);
    await user.click(document.body);
    expect(screen.queryByText("Taylor")).toBeNull();
  });
});
