import { describe, expect, it } from "vitest";
import { shouldStartWindowDrag } from "@/lib/windowDrag";

describe("shouldStartWindowDrag", () => {
  it("allows dragging from non-interactive elements", () => {
    const div = document.createElement("div");
    expect(shouldStartWindowDrag(div)).toBe(true);
  });

  it("blocks dragging from interactive elements", () => {
    const button = document.createElement("button");
    expect(shouldStartWindowDrag(button)).toBe(false);
  });

  it("blocks dragging from descendants of interactive elements", () => {
    const button = document.createElement("button");
    const span = document.createElement("span");
    button.appendChild(span);
    expect(shouldStartWindowDrag(span)).toBe(false);
  });

  it("blocks root drag handler when clicking dedicated tauri drag region", () => {
    const region = document.createElement("div");
    region.setAttribute("data-tauri-drag-region", "true");
    const child = document.createElement("span");
    region.appendChild(child);
    expect(shouldStartWindowDrag(child)).toBe(false);
  });
});
