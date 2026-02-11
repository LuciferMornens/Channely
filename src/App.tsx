import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  currentMonitor,
  cursorPosition,
  getCurrentWindow,
  monitorFromPoint,
} from "@tauri-apps/api/window";
import { toast, Toaster } from "sonner";
import { Overlay } from "@/components/overlay/Overlay";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { Settings } from "@/components/settings/Settings";
import { useOverlayStore } from "@/stores/overlayStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useTheme } from "@/hooks/useTheme";
import { normalizeAppError } from "@/lib/errors";
import { createStreamingBuffer } from "@/lib/streaming";
import { APP_EVENTS, CEREBRAS_EVENTS } from "@/lib/constants";
import type { DiffSegment } from "@/lib/diff";
import {
  computeOverlayPosition,
  type OverlayPositionMode,
} from "@/lib/windowPlacement";

const MIN_WIDTH = 400;
const MIN_HEIGHT = 200;
const MAX_WIDTH = 600;
const MAX_HEIGHT = 500;
const DEFAULT_OVERLAY_WIDTH = 480;
const DEFAULT_OVERLAY_HEIGHT = 320;

interface FocusModeStatus {
  supported: boolean;
  do_not_disturb: boolean;
  source: string;
}

interface CerebrasRetryPayload {
  attempt: number;
  total_attempts: number;
  backoff_ms: number;
}

function isOverlayPositionMode(value: string): value is OverlayPositionMode {
  return value === "cursor" || value === "center" || value === "top-right";
}

function App() {
  const [windowLabel, setWindowLabel] = useState<string | null>(null);
  const {
    config,
    loading: settingsLoading,
    loadSettings,
    markOnboardingCompleted,
    updateSettings,
  } = useSettingsStore();
  const { isDark } = useTheme();
  const focusModeCache = useRef({ checkedAtMs: 0, dnd: false });
  const acceptInFlightRef = useRef(false);
  const streamingBuffer = useRef(
    createStreamingBuffer((text) => {
      useOverlayStore.getState().setImprovedText(text);
    }),
  );

  // Detect window label (settings vs main/overlay)
  useEffect(() => {
    try {
      const win = getCurrentWindow();
      setWindowLabel(win.label);
    } catch {
      // Not in Tauri context (tests, browser)
      setWindowLabel("main");
    }
  }, []);

  useEffect(() => {
    const buffer = streamingBuffer.current;
    return () => {
      buffer.destroy();
    };
  }, []);

  // Load settings for main window (overlay/onboarding path).
  useEffect(() => {
    if (!windowLabel || windowLabel === "settings") return;
    void loadSettings();
  }, [windowLabel, loadSettings]);

  // Apply dark class to html element
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // Prevent Cmd+Shift+K from propagating to the webview when this window has focus.
  // The global shortcut handles it in the backend, but the key event can still reach
  // the webview after we call setFocus() to show the overlay. WebKit/Chromium may have
  // a built-in handler for this combo that closes the app. Block it here.
  useEffect(() => {
    if (windowLabel !== "main") return;

    const handler = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === "k" || e.key === "K")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [windowLabel]);

  // Keep the main window resizable for onboarding, then lock it back down
  // for floating overlay mode.
  useEffect(() => {
    if (windowLabel !== "main" || settingsLoading || !config) return;

    void (async () => {
      try {
        const win = getCurrentWindow();
        const onboardingVisible = !config.general.onboarding_completed;
        await win.setResizable(onboardingVisible);
      } catch {
        // Not in Tauri context (tests, browser)
      }
    })();
  }, [windowLabel, settingsLoading, config]);

  const isFocusModeEnabled = useCallback(async (): Promise<boolean> => {
    const now = Date.now();
    if (now - focusModeCache.current.checkedAtMs < 10_000) {
      return focusModeCache.current.dnd;
    }

    try {
      const status = await invoke<FocusModeStatus>("get_focus_mode_status");
      const dnd = Boolean(status?.do_not_disturb);
      focusModeCache.current = { checkedAtMs: now, dnd };
      return dnd;
    } catch {
      return false;
    }
  }, []);

  const positionWindow = useCallback(
    async (modeRaw: string) => {
      const mode: OverlayPositionMode = isOverlayPositionMode(modeRaw)
        ? modeRaw
        : "cursor";
      const win = getCurrentWindow();
      const cursor = await cursorPosition();
      const monitor =
        (await monitorFromPoint(cursor.x, cursor.y)) ?? (await currentMonitor());

      if (!monitor) {
        await win.center();
        return;
      }

      const size = await win.outerSize();
      const { PhysicalPosition } = await import("@tauri-apps/api/dpi");
      const position = computeOverlayPosition({
        mode,
        cursor,
        overlay: {
          width: size.width,
          height: size.height,
        },
        monitor: {
          workArea: monitor.workArea,
        },
      });
      await win.setPosition(new PhysicalPosition(position.x, position.y));
    },
    [],
  );

  // Auto-size overlay based on content
  const autoSize = useCallback(async () => {
    try {
      const win = getCurrentWindow();
      const root = document.getElementById("root");
      if (!root) return;

      const contentHeight = root.scrollHeight;
      const contentWidth = root.scrollWidth;

      const width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, contentWidth));
      const height = Math.max(
        MIN_HEIGHT,
        Math.min(MAX_HEIGHT, contentHeight + 16),
      );

      const { LogicalSize } = await import("@tauri-apps/api/dpi");
      await win.setSize(new LogicalSize(width, height));
      await positionWindow(config?.ui.overlay_position ?? "cursor");
    } catch {
      // Not in Tauri context (tests, browser)
    }
  }, [config, positionWindow]);

  const setOverlayShortcutsEnabled = useCallback(async (enabled: boolean) => {
    try {
      await invoke("set_overlay_shortcuts_enabled", { enabled });
    } catch (err) {
      console.warn("Could not update overlay shortcut handlers:", err);
    }
  }, []);

  // Show overlay window
  const showWindow = useCallback(async () => {
    const win = getCurrentWindow();

    try {
      await win.setResizable(false);
    } catch (err) {
      console.warn("Could not lock overlay window resize:", err);
    }

    try {
      if (await win.isMaximized()) {
        await win.unmaximize();
      }
    } catch (err) {
      console.warn("Could not unmaximize overlay window:", err);
    }

    try {
      const { LogicalSize } = await import("@tauri-apps/api/dpi");
      await win.setSize(
        new LogicalSize(DEFAULT_OVERLAY_WIDTH, DEFAULT_OVERLAY_HEIGHT),
      );
    } catch (err) {
      console.warn("Could not set overlay window size:", err);
    }

    try {
      await positionWindow(config?.ui.overlay_position ?? "cursor");
    } catch (err) {
      console.warn("Could not position overlay window:", err);
    }

    try {
      await win.show();
    } catch (err) {
      console.warn("Could not show overlay window:", err);
      return;
    }

    await setOverlayShortcutsEnabled(true);

    try {
      const dnd = await isFocusModeEnabled();
      if (!dnd) {
        await win.setFocus();
      }
    } catch (err) {
      console.warn("Could not focus overlay window:", err);
    }
  }, [config, isFocusModeEnabled, positionWindow, setOverlayShortcutsEnabled]);

  // Hide overlay window
  const hideWindow = useCallback(async () => {
    await setOverlayShortcutsEnabled(false);

    try {
      const win = getCurrentWindow();
      await win.hide();
    } catch (err) {
      console.warn("Could not hide overlay window:", err);
    }
  }, [setOverlayShortcutsEnabled]);

  useEffect(() => {
    if (windowLabel !== "main") return;

    return () => {
      void setOverlayShortcutsEnabled(false);
    };
  }, [windowLabel, setOverlayShortcutsEnabled]);

  // Listen for text-captured events from backend
  useEffect(() => {
    if (
      windowLabel !== "main" ||
      settingsLoading ||
      !config?.general.onboarding_completed
    ) {
      return;
    }

    let unlisten: (() => void) | undefined;

    listen<string>(APP_EVENTS.TEXT_CAPTURED, (event) => {
      const text = event.payload;
      if (text) {
        streamingBuffer.current.reset();
        useOverlayStore.getState().show(text);
        void showWindow();
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => unlisten?.();
  }, [windowLabel, settingsLoading, config, showWindow]);

  // Listen for streaming delta tokens
  useEffect(() => {
    if (
      windowLabel !== "main" ||
      settingsLoading ||
      !config?.general.onboarding_completed
    ) {
      return;
    }

    let unlisten: (() => void) | undefined;

    listen<string>(CEREBRAS_EVENTS.DELTA, (event) => {
      streamingBuffer.current.append(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => unlisten?.();
  }, [windowLabel, settingsLoading, config]);

  // Listen for streaming completion
  useEffect(() => {
    if (
      windowLabel !== "main" ||
      settingsLoading ||
      !config?.general.onboarding_completed
    ) {
      return;
    }

    let unlisten: (() => void) | undefined;

    listen(CEREBRAS_EVENTS.DONE, async () => {
      try {
        streamingBuffer.current.flush();
        const improvedText = streamingBuffer.current.text();
        const { originalText } = useOverlayStore.getState();

        const segments = await invoke<DiffSegment[]>("compute_diff", {
          original: originalText,
          improved: improvedText,
        });
        useOverlayStore.getState().setSegments(segments);

        // Auto-size after content renders
        globalThis.setTimeout(() => {
          void autoSize();
        }, 50);
      } catch (err) {
        const message = normalizeAppError(err);
        useOverlayStore.getState().setError(message);
        toast.error("Could not compute diff", { description: message });
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => unlisten?.();
  }, [windowLabel, settingsLoading, config, autoSize]);

  // Listen for warnings/errors/retry events
  useEffect(() => {
    if (
      windowLabel !== "main" ||
      settingsLoading ||
      !config?.general.onboarding_completed
    ) {
      return;
    }

    let unlistenError: (() => void) | undefined;
    let unlistenWarning: (() => void) | undefined;
    let unlistenRetrying: (() => void) | undefined;

    listen<string>(APP_EVENTS.CAPTURE_ERROR, (event) => {
      const message = normalizeAppError(event.payload);
      const overlay = useOverlayStore.getState();
      if (!overlay.visible) {
        overlay.show("");
        void showWindow();
      }
      overlay.setError(message);
      toast.error("Proofreading failed", { description: message });
    }).then((fn) => {
      unlistenError = fn;
    });

    listen<string>(APP_EVENTS.CAPTURE_WARNING, (event) => {
      toast.warning("Long text was truncated", {
        description: event.payload,
      });
    }).then((fn) => {
      unlistenWarning = fn;
    });

    listen<CerebrasRetryPayload>(CEREBRAS_EVENTS.RETRYING, (event) => {
      const payload = event.payload;
      const seconds = Math.max(1, Math.ceil(payload.backoff_ms / 1000));
      toast.info("Retrying Cerebras request", {
        description: `Attempt ${payload.attempt}/${payload.total_attempts} in ${seconds}s`,
      });
    }).then((fn) => {
      unlistenRetrying = fn;
    });

    return () => {
      unlistenError?.();
      unlistenWarning?.();
      unlistenRetrying?.();
    };
  }, [windowLabel, settingsLoading, config, showWindow]);

  // Accept handler: paste corrected text, hide overlay
  const handleAccept = useCallback(async () => {
    if (acceptInFlightRef.current) {
      return;
    }

    const overlay = useOverlayStore.getState();
    if (!overlay.visible) {
      return;
    }

    const improvedText = streamingBuffer.current.text();
    if (!improvedText.trim()) {
      const message = "No improved text available to replace yet.";
      useOverlayStore.getState().setError(message);
      toast.error("Nothing to replace", { description: message });
      return;
    }

    acceptInFlightRef.current = true;

    try {
      await invoke("accept_overlay_text", { text: improvedText });
      useOverlayStore.getState().accept();
    } catch (err) {
      const message = normalizeAppError(err);
      toast.error("Failed to replace text", { description: message });
      useOverlayStore.getState().setError(message);
      void showWindow();
      return;
    } finally {
      acceptInFlightRef.current = false;
    }
  }, [showWindow]);

  // Dismiss handler: hide overlay, restore clipboard
  const handleDismiss = useCallback(async () => {
    if (acceptInFlightRef.current) {
      return;
    }

    useOverlayStore.getState().dismiss();
    void hideWindow();
  }, [hideWindow]);

  useEffect(() => {
    if (
      windowLabel !== "main" ||
      settingsLoading ||
      !config?.general.onboarding_completed
    ) {
      return;
    }

    let unlistenAccept: (() => void) | undefined;
    let unlistenDismiss: (() => void) | undefined;

    listen<string>(APP_EVENTS.OVERLAY_ACCEPT, () => {
      void handleAccept();
    }).then((fn) => {
      unlistenAccept = fn;
    });

    listen<string>(APP_EVENTS.OVERLAY_DISMISS, () => {
      void handleDismiss();
    }).then((fn) => {
      unlistenDismiss = fn;
    });

    return () => {
      unlistenAccept?.();
      unlistenDismiss?.();
    };
  }, [windowLabel, settingsLoading, config, handleAccept, handleDismiss]);

  // Style change handler: re-trigger AI with new style
  const handleStyleChange = useCallback(async (newStyle: string) => {
    const overlay = useOverlayStore.getState();
    overlay.setStyle(newStyle);
    overlay.setLoading(true);
    overlay.setError(null);
    streamingBuffer.current.reset();

    try {
      await invoke("proofread_text", {
        text: overlay.originalText,
        style: newStyle,
      });
    } catch (err) {
      const message = normalizeAppError(err);
      overlay.setError(message);
      toast.error("AI request failed", { description: message });
    }
  }, []);

  const handleOnboardingComplete = useCallback(async () => {
    await markOnboardingCompleted();
    await hideWindow();
  }, [markOnboardingCompleted, hideWindow]);

  const handleSaveOnboardingApiKey = useCallback(
    async (apiKey: string) => {
      await updateSettings((current) => ({
        ...current,
        ai: {
          ...current.ai,
          api_key: apiKey,
        },
      }));
    },
    [updateSettings],
  );

  // Settings window renders the Settings UI
  if (windowLabel === "settings") {
    return <Settings />;
  }

  // Wait until window label and settings are loaded.
  if (!windowLabel || settingsLoading || !config) {
    return <div className="min-h-screen" />;
  }

  // First-run path: onboarding flow.
  if (!config.general.onboarding_completed) {
    return (
      <>
        <Onboarding
          onComplete={handleOnboardingComplete}
          initialApiKey={config.ai.api_key}
          onSaveApiKey={handleSaveOnboardingApiKey}
        />
        <Toaster
          position="bottom-right"
          theme={isDark ? "dark" : "light"}
          richColors
          closeButton
        />
      </>
    );
  }

  // Main window renders the floating overlay
  return (
    <>
      <div className="select-none">
        <Overlay
          onAccept={handleAccept}
          onDismiss={handleDismiss}
          onStyleChange={handleStyleChange}
          animationsEnabled={config.ui.animations}
        />
      </div>
      <Toaster
        position="bottom-right"
        theme={isDark ? "dark" : "light"}
        richColors
        closeButton
      />
    </>
  );
}

export default App;
