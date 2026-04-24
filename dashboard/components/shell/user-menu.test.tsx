import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type { Session } from "next-auth";

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

import { UserMenu } from "./user-menu";

const mockSession: Session = {
  user: { name: "Test User", email: "test@example.com", image: null, role: "viewer" },
  expires: "2099-01-01",
};

describe("UserMenu — Menu.Group wrapping", () => {
  it("renders the avatar trigger", () => {
    render(<UserMenu session={mockSession} />);
    const trigger = screen.getByRole("button");
    expect(trigger).toBeTruthy();
  });

  it("opening menu shows email label without MenuGroupRootContext error", async () => {
    const user = userEvent.setup();
    render(<UserMenu session={mockSession} />);
    await user.click(screen.getByRole("button"));
    // base-ui renders into a portal; use findBy* for async mount.
    // If DropdownMenuLabel lacks a DropdownMenuGroup parent, base-ui throws
    // and the ErrorBoundary replaces the content — findByText would reject.
    expect(await screen.findByText("test@example.com")).toBeTruthy();
  });

  it("opening menu shows Sign out item", async () => {
    const user = userEvent.setup();
    render(<UserMenu session={mockSession} />);
    await user.click(screen.getByRole("button"));
    expect(await screen.findByText("Sign out")).toBeTruthy();
  });
});
