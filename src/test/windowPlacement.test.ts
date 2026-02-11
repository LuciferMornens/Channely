import { describe, it, expect } from "vitest";
import { computeOverlayPosition } from "@/lib/windowPlacement";

const monitor = {
  workArea: {
    position: { x: 0, y: 0 },
    size: { width: 1920, height: 1080 },
  },
};

describe("computeOverlayPosition", () => {
  it("centers overlay for center mode", () => {
    const pos = computeOverlayPosition({
      mode: "center",
      cursor: { x: 800, y: 200 },
      overlay: { width: 480, height: 320 },
      monitor,
    });
    expect(pos).toEqual({ x: 720, y: 380 });
  });

  it("pins overlay to top-right work area", () => {
    const pos = computeOverlayPosition({
      mode: "top-right",
      cursor: { x: 100, y: 100 },
      overlay: { width: 480, height: 320 },
      monitor,
    });
    expect(pos.x).toBe(1424);
    expect(pos.y).toBe(16);
  });

  it("keeps cursor mode overlay within work area bounds", () => {
    const pos = computeOverlayPosition({
      mode: "cursor",
      cursor: { x: 1890, y: 1060 },
      overlay: { width: 480, height: 320 },
      monitor,
    });
    expect(pos.x).toBeLessThanOrEqual(1424);
    expect(pos.y).toBeLessThanOrEqual(744);
  });

  it("handles negative-coordinate monitor for multi-display layouts", () => {
    const leftMonitor = {
      workArea: {
        position: { x: -1728, y: 0 },
        size: { width: 1728, height: 1117 },
      },
    };

    const pos = computeOverlayPosition({
      mode: "cursor",
      cursor: { x: -1600, y: 200 },
      overlay: { width: 500, height: 280 },
      monitor: leftMonitor,
    });

    expect(pos.x).toBeGreaterThanOrEqual(-1712);
    expect(pos.x).toBeLessThanOrEqual(-516);
    expect(pos.y).toBeGreaterThanOrEqual(16);
  });
});
