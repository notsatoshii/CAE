import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConfirmActionDialog } from "./confirm-action-dialog";

type ToastOpts = { action?: { label: string; onClick: () => void }; duration?: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toastMock = vi.fn<any>(() => 0);
vi.mock("sonner", () => ({ toast: (msg: string, opts?: ToastOpts) => toastMock(msg, opts) }));

let devMode = false;
vi.mock("@/lib/providers/dev-mode", () => ({
  useDevMode: () => ({ dev: devMode, toggle: vi.fn() }),
}));

describe("ConfirmActionDialog", () => {
  beforeEach(() => {
    devMode = false;
    toastMock.mockClear();
  });

  it("renders dialog when open + founder-mode", () => {
    render(
      <ConfirmActionDialog
        open
        onOpenChange={vi.fn()}
        spec={{ type: "workflow_run", slug: "x" }}
        summary="Run the upgrade-deps recipe"
        onAccept={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByTestId("confirm-action-dialog")).toBeDefined();
    expect(screen.getByText(/Run the upgrade-deps recipe/)).toBeDefined();
    expect(screen.getByText(/tok/)).toBeDefined();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it("calls onAccept then closes on Accept click", async () => {
    const onAccept = vi.fn();
    const onOpen = vi.fn();
    render(
      <ConfirmActionDialog
        open
        onOpenChange={onOpen}
        spec={{ type: "delegate_new" }}
        summary="Delegate new build"
        onAccept={onAccept}
      />,
    );
    // Accept button label is "Go" in founder mode
    fireEvent.click(screen.getByRole("button", { name: /go/i }));
    await waitFor(() => expect(onAccept).toHaveBeenCalled());
    expect(onOpen).toHaveBeenCalledWith(false);
  });

  it("calls onCancel on Cancel click", () => {
    const onCancel = vi.fn();
    const onOpen = vi.fn();
    render(
      <ConfirmActionDialog
        open
        onOpenChange={onOpen}
        spec={{ type: "delegate_new" }}
        summary="..."
        onAccept={vi.fn()}
        onCancel={onCancel}
      />,
    );
    // Cancel button label is "Cancel" in founder mode
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
    expect(onOpen).toHaveBeenCalledWith(false);
  });

  it("renders diff preview in monospace when provided", () => {
    render(
      <ConfirmActionDialog
        open
        onOpenChange={vi.fn()}
        spec={{ type: "delegate_new" }}
        summary="Delegate new build"
        diffPreview="+ line added"
        onAccept={vi.fn()}
      />,
    );
    const pre = screen.getByText(/\+ line added/);
    expect(pre.tagName.toLowerCase()).toBe("pre");
  });

  it("does not render dialog when open=false", () => {
    render(
      <ConfirmActionDialog
        open={false}
        onOpenChange={vi.fn()}
        spec={{ type: "delegate_new" }}
        summary="Delegate new build"
        onAccept={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("confirm-action-dialog")).toBeNull();
  });

  it("dev-mode bypasses dialog and calls onAccept + toast", async () => {
    devMode = true;
    const onAccept = vi.fn();
    render(
      <ConfirmActionDialog
        open
        onOpenChange={vi.fn()}
        spec={{ type: "workflow_run", slug: "x" }}
        summary="Do it"
        onAccept={onAccept}
        onCancel={vi.fn()}
      />,
    );
    await waitFor(() => expect(onAccept).toHaveBeenCalled());
    expect(toastMock).toHaveBeenCalled();
    // In dev-mode, no Dialog in the DOM:
    expect(screen.queryByTestId("confirm-action-dialog")).toBeNull();
  });

  it("dev-mode toast undo action calls onCancel", async () => {
    devMode = true;
    const onCancel = vi.fn();
    render(
      <ConfirmActionDialog
        open
        onOpenChange={vi.fn()}
        spec={{ type: "workflow_run", slug: "x" }}
        summary="Do it"
        onAccept={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await waitFor(() => expect(toastMock).toHaveBeenCalled());
    // Extract the action from the toast call and invoke it
    const toastArgs = toastMock.mock.calls[0];
    const opts = toastArgs[1] as { action?: { label: string; onClick: () => void } };
    expect(opts?.action?.label).toMatch(/undo/i);
    opts?.action?.onClick();
    expect(onCancel).toHaveBeenCalled();
  });

  it("cost label uses tok not dollar-sign", () => {
    render(
      <ConfirmActionDialog
        open
        onOpenChange={vi.fn()}
        spec={{ type: "delegate_new" }}
        summary="Delegate"
        onAccept={vi.fn()}
      />,
    );
    // Should contain "tok"
    expect(screen.getByText(/tok/)).toBeDefined();
    // Should NOT contain "$"
    expect(screen.queryByText(/\$/)).toBeNull();
  });
});
