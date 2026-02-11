import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { tauriMockState } from "./mocks/tauri";
import { UndecoratedWindowChrome } from "@/components/window/UndecoratedWindowChrome";

describe("UndecoratedWindowChrome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tauriMockState.window.isMaximized.mockResolvedValue(false);
  });

  it("starts dragging when drag region is pressed", async () => {
    render(<UndecoratedWindowChrome />);

    fireEvent.mouseDown(screen.getByTestId("window-drag-region"), { button: 0 });

    await waitFor(() => {
      expect(tauriMockState.window.startDragging).toHaveBeenCalledTimes(1);
    });
  });

  it("minimizes the window from control button", async () => {
    render(<UndecoratedWindowChrome />);

    fireEvent.click(screen.getByRole("button", { name: /minimize window/i }));

    await waitFor(() => {
      expect(tauriMockState.window.minimize).toHaveBeenCalledTimes(1);
    });
  });

  it("toggles maximize and updates label to restore", async () => {
    tauriMockState.window.isMaximized.mockResolvedValueOnce(true);

    render(<UndecoratedWindowChrome />);

    fireEvent.click(screen.getByRole("button", { name: /maximize window/i }));

    await waitFor(() => {
      expect(tauriMockState.window.toggleMaximize).toHaveBeenCalledTimes(1);
      expect(
        screen.getByRole("button", { name: /restore window/i }),
      ).toBeInTheDocument();
    });
  });

  it("starts southeast resize dragging from handle", async () => {
    render(<UndecoratedWindowChrome showResizeHandle />);

    fireEvent.mouseDown(screen.getByRole("button", { name: /resize window/i }), {
      button: 0,
    });

    await waitFor(() => {
      expect(tauriMockState.window.startResizeDragging).toHaveBeenCalledWith(
        "SouthEast",
      );
    });
  });
});
