// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountMenu } from "./AccountMenu";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("AccountMenu", () => {
  afterEach(() => {
    cleanup();
    refresh.mockClear();
    vi.unstubAllGlobals();
  });

  it("opens account details from the avatar without signing out", async () => {
    const user = userEvent.setup();
    const signOutAction = vi.fn();
    render(
      <AccountMenu
        displayName="Sam Builder"
        email="sam@example.com"
        hasCompany
        canManageOrganization
        accounts={[{ companyId: "company-1", companyName: "Acme", role: "OWNER", isActive: true }]}
        signOutAction={signOutAction}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open account menu for Sam Builder" }));

    expect(signOutAction).not.toHaveBeenCalled();
    expect(screen.getByText("Sam Builder")).toBeTruthy();
    expect(screen.getByText("sam@example.com")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Organization" }).getAttribute("href")).toBe("/settings/organization");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("switches between active account memberships", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AccountMenu
        displayName="Sam Builder"
        email="sam@example.com"
        hasCompany
        canManageOrganization
        accounts={[
          { companyId: "company-1", companyName: "Acme", role: "OWNER", isActive: true },
          { companyId: "company-2", companyName: "North Division", role: "ADMIN", isActive: false },
        ]}
        signOutAction={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open account menu for Sam Builder" }));
    await user.click(screen.getByRole("button", { name: /North Division/i }));

    expect(fetchMock).toHaveBeenCalledWith("/api/organization/switch", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ companyId: "company-2" }),
    }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("toggles and dismisses the account menu", async () => {
    const user = userEvent.setup();
    render(
      <AccountMenu
        displayName="Taylor"
        email={null}
        hasCompany={false}
        accounts={[]}
        signOutAction={vi.fn()}
      />,
    );

    const avatar = screen.getByRole("button", { name: "Open account menu for Taylor" });
    expect(avatar.textContent).toBe("T");

    await user.click(avatar);
    expect(screen.getByText("Taylor")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Organization" })).toBeNull();

    await user.click(avatar);
    expect(screen.queryByText("Taylor")).toBeNull();

    await user.click(avatar);
    await user.click(document.body);
    expect(screen.queryByText("Taylor")).toBeNull();
  });
});
