import { describe, expect, it } from "vitest";
import tauriConfig from "../../src-tauri/tauri.conf.json";
import defaultCapability from "../../src-tauri/capabilities/default.json";

function getMainWindowConfig(): {
  app: Record<string, unknown>;
  mainWindow: Record<string, unknown> | undefined;
} {
  const app = tauriConfig.app as Record<string, unknown>;
  const windows = app.windows as Array<Record<string, unknown>>;
  return { app, mainWindow: windows.find((window) => window.label === "main") };
}

describe("Tauri window drag requirements", () => {
  it("enables macOS private API when main window is transparent and undecorated", () => {
    const { app, mainWindow } = getMainWindowConfig();

    expect(mainWindow).toBeDefined();
    expect(mainWindow?.transparent).toBe(true);
    expect(mainWindow?.decorations).toBe(false);
    expect(app.macOSPrivateApi).toBe(true);
  });

  it("keeps window-drag permissions aligned with custom chrome behavior", () => {
    const permissions = defaultCapability.permissions as string[];

    expect(permissions).toContain("core:window:allow-start-dragging");
    expect(permissions).toContain("core:window:allow-start-resize-dragging");
  });
});
