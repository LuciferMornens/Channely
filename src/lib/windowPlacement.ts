export type OverlayPositionMode = "cursor" | "center" | "top-right";

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface WorkArea {
  position: Point;
  size: Size;
}

export interface MonitorLike {
  workArea: WorkArea;
}

export interface PlacementParams {
  mode: OverlayPositionMode;
  cursor: Point;
  overlay: Size;
  monitor: MonitorLike;
  margin?: number;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function computeOverlayPosition({
  mode,
  cursor,
  overlay,
  monitor,
  margin = 16,
}: PlacementParams): Point {
  const workX = monitor.workArea.position.x;
  const workY = monitor.workArea.position.y;
  const workW = monitor.workArea.size.width;
  const workH = monitor.workArea.size.height;

  const maxX = workX + workW - overlay.width - margin;
  const maxY = workY + workH - overlay.height - margin;

  if (mode === "center") {
    return {
      x: Math.round(workX + (workW - overlay.width) / 2),
      y: Math.round(workY + (workH - overlay.height) / 2),
    };
  }

  if (mode === "top-right") {
    return {
      x: Math.round(maxX),
      y: Math.round(workY + margin),
    };
  }

  // Cursor mode: place slightly below/right of cursor and clamp to monitor work area.
  return {
    x: Math.round(clamp(cursor.x + 18, workX + margin, maxX)),
    y: Math.round(clamp(cursor.y + 20, workY + margin, maxY)),
  };
}
