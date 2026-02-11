import { vi } from "vitest";

// Store for controlling mock behavior in tests
export const tauriMockState = {
  windowLabel: "main",
  invokeHandlers: new Map<string, (...args: unknown[]) => unknown>(),
  eventListeners: new Map<string, (event: { payload: unknown }) => void>(),
  window: {
    label: "main",
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    minimize: vi.fn(() => Promise.resolve()),
    toggleMaximize: vi.fn(() => Promise.resolve()),
    unmaximize: vi.fn(() => Promise.resolve()),
    isMaximized: vi.fn(() => Promise.resolve(false)),
    startDragging: vi.fn(() => Promise.resolve()),
    startResizeDragging: vi.fn(() => Promise.resolve()),
    center: vi.fn(() => Promise.resolve()),
    setFocus: vi.fn(() => Promise.resolve()),
    setSize: vi.fn(() => Promise.resolve()),
    setResizable: vi.fn(() => Promise.resolve()),
    setPosition: vi.fn(() => Promise.resolve()),
    outerSize: vi.fn(() => Promise.resolve({ width: 480, height: 320 })),
  },
};

export function emitMockEvent<T>(name: string, payload: T): void {
  const listener = tauriMockState.eventListeners.get(name);
  if (listener) {
    listener({ payload });
  }
}

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
    const handler = tauriMockState.invokeHandlers.get(cmd);
    if (handler) return handler(args);
    return undefined;
  }),
}));

// Mock @tauri-apps/api/event
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((name: string, callback: (event: { payload: unknown }) => void) => {
    tauriMockState.eventListeners.set(name, callback);
    return Promise.resolve(() => {
      tauriMockState.eventListeners.delete(name);
    });
  }),
  emit: vi.fn(() => Promise.resolve()),
}));

// Mock @tauri-apps/api/window
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    ...tauriMockState.window,
    label: tauriMockState.windowLabel,
  })),
  currentMonitor: vi.fn(() =>
    Promise.resolve({
      workArea: {
        position: { x: 0, y: 0 },
        size: { width: 1920, height: 1080 },
      },
    }),
  ),
  monitorFromPoint: vi.fn(() =>
    Promise.resolve({
      workArea: {
        position: { x: 0, y: 0 },
        size: { width: 1920, height: 1080 },
      },
    }),
  ),
  cursorPosition: vi.fn(() => Promise.resolve({ x: 100, y: 100 })),
}));

// Mock @tauri-apps/api/dpi
vi.mock("@tauri-apps/api/dpi", () => ({
  LogicalSize: class LogicalSize {
    width: number;
    height: number;
    constructor(w: number, h: number) {
      this.width = w;
      this.height = h;
    }
  },
  PhysicalPosition: class PhysicalPosition {
    x: number;
    y: number;
    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  },
}));
