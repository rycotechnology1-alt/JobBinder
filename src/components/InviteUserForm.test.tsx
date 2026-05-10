// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InviteUserForm } from "./InviteUserForm";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}));

describe("InviteUserForm", () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      }),
    );
  });

  it("clears the form and refreshes after a successful invite", async () => {
    const user = userEvent.setup();
    render(<InviteUserForm />);

    const emailInput = screen.getByPlaceholderText("crew@company.com");
    await user.type(emailInput, "crew@example.com");
    await user.click(screen.getByRole("button", { name: "Invite" }));

    await waitFor(() => {
      expect(screen.getByText("Invite email sent.")).toBeTruthy();
    });

    expect((emailInput as HTMLInputElement).value).toBe("");
    expect(refresh).toHaveBeenCalledOnce();
  });
});
