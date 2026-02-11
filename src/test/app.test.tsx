import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { emitMockEvent, tauriMockState } from "./mocks/tauri";
import App from "@/App";
import { DEFAULT_CONFIG, type AppConfig } from "@/stores/settingsStore";
import { useOverlayStore } from "@/stores/overlayStore";
import { APP_EVENTS, CEREBRAS_EVENTS } from "@/lib/constants";

function configWithOnboarding(completed: boolean): AppConfig {
  return {
    ...structuredClone(DEFAULT_CONFIG),
    general: {
      ...DEFAULT_CONFIG.general,
      onboarding_completed: completed,
    },
  };
}

describe("App onboarding gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tauriMockState.windowLabel = "main";
    tauriMockState.invokeHandlers.clear();
    tauriMockState.eventListeners.clear();
    tauriMockState.window.show.mockClear();
    tauriMockState.window.hide.mockClear();
    tauriMockState.window.minimize.mockClear();
    tauriMockState.window.toggleMaximize.mockClear();
    tauriMockState.window.startDragging.mockClear();
    tauriMockState.window.startResizeDragging.mockClear();
    tauriMockState.window.unmaximize.mockClear();
    tauriMockState.window.isMaximized.mockClear();
    tauriMockState.window.setFocus.mockClear();
    tauriMockState.window.setPosition.mockClear();
    tauriMockState.window.setSize.mockClear();
    tauriMockState.window.setResizable.mockClear();
    useOverlayStore.setState({
      visible: false,
      loading: false,
      error: null,
      originalText: "",
      improvedText: "",
      segments: [],
      style: "casual",
    });
  });

  it("shows onboarding for first-run users", async () => {
    tauriMockState.invokeHandlers.set("get_settings", () =>
      configWithOnboarding(false),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("onboarding-flow")).toBeInTheDocument();
    });
    expect(screen.getByText("Welcome to Channely")).toBeInTheDocument();
  });

  it("renders onboarding window chrome controls and triggers window APIs", async () => {
    tauriMockState.invokeHandlers.set("get_settings", () =>
      configWithOnboarding(false),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("onboarding-flow")).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByTestId("window-drag-region"), { button: 0 });
    fireEvent.click(screen.getByRole("button", { name: /minimize window/i }));
    fireEvent.click(screen.getByRole("button", { name: /maximize window/i }));
    fireEvent.mouseDown(screen.getByRole("button", { name: /resize window/i }), {
      button: 0,
    });

    await waitFor(() => {
      expect(tauriMockState.window.startDragging).toHaveBeenCalledTimes(1);
      expect(tauriMockState.window.minimize).toHaveBeenCalledTimes(1);
      expect(tauriMockState.window.toggleMaximize).toHaveBeenCalledTimes(1);
      expect(tauriMockState.window.startResizeDragging).toHaveBeenCalledWith(
        "SouthEast",
      );
    });
  });

  it("skips onboarding for returning users", async () => {
    tauriMockState.invokeHandlers.set("get_settings", () =>
      configWithOnboarding(true),
    );

    const { container } = render(<App />);

    await waitFor(() => {
      expect(screen.queryByTestId("onboarding-flow")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(container.querySelector(".select-none")).toBeInTheDocument();
    });
  });

  it("stores capture error payload in overlay error state", async () => {
    tauriMockState.invokeHandlers.set("get_settings", () =>
      configWithOnboarding(true),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByTestId("onboarding-flow")).not.toBeInTheDocument();
    });

    act(() => {
      emitMockEvent(APP_EVENTS.CAPTURE_ERROR, "No internet connection");
    });
    await waitFor(() => {
      expect(useOverlayStore.getState().error).toBe("No internet connection");
    });
  });

  it("shows the overlay window when capture fails", async () => {
    tauriMockState.invokeHandlers.set("get_settings", () =>
      configWithOnboarding(true),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByTestId("onboarding-flow")).not.toBeInTheDocument();
    });

    act(() => {
      emitMockEvent(APP_EVENTS.CAPTURE_ERROR, "No text selected");
    });

    await waitFor(() => {
      expect(tauriMockState.window.show).toHaveBeenCalled();
      expect(useOverlayStore.getState().visible).toBe(true);
      expect(useOverlayStore.getState().error).toBe("No text selected");
    });
  });

  it("positions and shows overlay when text is captured", async () => {
    tauriMockState.invokeHandlers.set("get_settings", () =>
      configWithOnboarding(true),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByTestId("onboarding-flow")).not.toBeInTheDocument();
    });

    act(() => {
      emitMockEvent(APP_EVENTS.TEXT_CAPTURED, "hello");
    });
    await waitFor(() => {
      expect(tauriMockState.window.setPosition).toHaveBeenCalled();
      expect(tauriMockState.window.show).toHaveBeenCalled();
      expect(tauriMockState.window.setFocus).toHaveBeenCalled();
    });
  });

  it("avoids forcing focus when do not disturb is active", async () => {
    tauriMockState.invokeHandlers.set("get_settings", () =>
      configWithOnboarding(true),
    );
    tauriMockState.invokeHandlers.set("get_focus_mode_status", () => ({
      supported: true,
      do_not_disturb: true,
      source: "test",
    }));

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByTestId("onboarding-flow")).not.toBeInTheDocument();
    });

    act(() => {
      emitMockEvent(APP_EVENTS.TEXT_CAPTURED, "hello");
    });
    await waitFor(() => {
      expect(tauriMockState.window.show).toHaveBeenCalled();
    });
    expect(tauriMockState.window.setFocus).not.toHaveBeenCalled();
  });

  it("still shows overlay when positioning fails", async () => {
    tauriMockState.invokeHandlers.set("get_settings", () =>
      configWithOnboarding(true),
    );
    tauriMockState.window.setPosition.mockRejectedValueOnce(
      new Error("position failed"),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByTestId("onboarding-flow")).not.toBeInTheDocument();
    });

    act(() => {
      emitMockEvent(APP_EVENTS.TEXT_CAPTURED, "hello");
    });

    await waitFor(() => {
      expect(tauriMockState.window.show).toHaveBeenCalled();
    });
  });

  it("uses backend accept command when overlay-accept event fires", async () => {
    tauriMockState.invokeHandlers.set("get_settings", () =>
      configWithOnboarding(true),
    );

    let acceptedText = "";
    let replaceTextCalled = false;
    tauriMockState.invokeHandlers.set("accept_overlay_text", (args) => {
      acceptedText = String((args as { text?: string })?.text ?? "");
      return undefined;
    });
    tauriMockState.invokeHandlers.set("replace_text", () => {
      replaceTextCalled = true;
      return undefined;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByTestId("onboarding-flow")).not.toBeInTheDocument();
    });

    act(() => {
      emitMockEvent(APP_EVENTS.TEXT_CAPTURED, "hello");
      emitMockEvent(CEREBRAS_EVENTS.DELTA, "hello fixed");
    });

    await waitFor(() => {
      expect(useOverlayStore.getState().visible).toBe(true);
    });

    act(() => {
      emitMockEvent(APP_EVENTS.OVERLAY_ACCEPT, "Enter");
    });

    await waitFor(() => {
      expect(acceptedText).toBe("hello fixed");
      expect(replaceTextCalled).toBe(false);
      expect(useOverlayStore.getState().visible).toBe(false);
    });
  });

  it("ignores overlay-accept events while overlay is hidden", async () => {
    tauriMockState.invokeHandlers.set("get_settings", () =>
      configWithOnboarding(true),
    );

    let acceptCalls = 0;
    tauriMockState.invokeHandlers.set("accept_overlay_text", () => {
      acceptCalls += 1;
      return undefined;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByTestId("onboarding-flow")).not.toBeInTheDocument();
    });

    act(() => {
      emitMockEvent(APP_EVENTS.OVERLAY_ACCEPT, "Enter");
    });

    await waitFor(() => {
      expect(acceptCalls).toBe(0);
    });
  });

  it("suppresses duplicate accept while backend replace is in flight", async () => {
    tauriMockState.invokeHandlers.set("get_settings", () =>
      configWithOnboarding(true),
    );

    let acceptCalls = 0;
    let resolveAccept: (() => void) | null = null;
    tauriMockState.invokeHandlers.set("accept_overlay_text", () => {
      acceptCalls += 1;
      return new Promise<void>((resolve) => {
        resolveAccept = resolve;
      });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByTestId("onboarding-flow")).not.toBeInTheDocument();
    });

    act(() => {
      emitMockEvent(APP_EVENTS.TEXT_CAPTURED, "hello");
      emitMockEvent(CEREBRAS_EVENTS.DELTA, "hello fixed");
    });

    await waitFor(() => {
      expect(useOverlayStore.getState().visible).toBe(true);
    });

    act(() => {
      emitMockEvent(APP_EVENTS.OVERLAY_ACCEPT, "Enter");
      emitMockEvent(APP_EVENTS.OVERLAY_ACCEPT, "Enter");
    });

    await waitFor(() => {
      expect(acceptCalls).toBe(1);
    });

    await act(async () => {
      resolveAccept?.();
    });

    await waitFor(() => {
      expect(useOverlayStore.getState().visible).toBe(false);
    });
  });
});
