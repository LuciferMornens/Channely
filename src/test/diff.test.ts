import { describe, it, expect } from "vitest";
import {
  DiffSegment,
  hasChanges,
  getOriginalText,
  getImprovedText,
  countChanges,
} from "../lib/diff";

// Sample data matching Rust output structure
const sampleDiff: DiffSegment[] = [
  { text: "I ", kind: "added" },
  { text: "i ", kind: "removed" },
  { text: "don't", kind: "added" },
  { text: "dont", kind: "removed" },
  { text: " want", kind: "unchanged" },
];

const identicalDiff: DiffSegment[] = [
  { text: "Hello, world!", kind: "unchanged" },
];

const emptyDiff: DiffSegment[] = [];

describe("DiffSegment types match Rust output", () => {
  it("sample data has correct shape", () => {
    for (const seg of sampleDiff) {
      expect(seg).toHaveProperty("text");
      expect(seg).toHaveProperty("kind");
      expect(["unchanged", "added", "removed"]).toContain(seg.kind);
      expect(typeof seg.text).toBe("string");
    }
  });

  it("kind values are lowercase strings matching Rust serde", () => {
    const kinds = new Set(sampleDiff.map((s) => s.kind));
    for (const k of kinds) {
      expect(k).toMatch(/^(unchanged|added|removed)$/);
    }
  });
});

describe("hasChanges", () => {
  it("returns true when there are added/removed segments", () => {
    expect(hasChanges(sampleDiff)).toBe(true);
  });

  it("returns false when all segments are unchanged", () => {
    expect(hasChanges(identicalDiff)).toBe(false);
  });

  it("returns false for empty segments", () => {
    expect(hasChanges(emptyDiff)).toBe(false);
  });

  it("returns true with only added segments", () => {
    expect(hasChanges([{ text: "new", kind: "added" }])).toBe(true);
  });

  it("returns true with only removed segments", () => {
    expect(hasChanges([{ text: "old", kind: "removed" }])).toBe(true);
  });
});

describe("getOriginalText", () => {
  it("reconstructs original from unchanged + removed", () => {
    expect(getOriginalText(sampleDiff)).toBe("i dont want");
  });

  it("returns full text when no changes", () => {
    expect(getOriginalText(identicalDiff)).toBe("Hello, world!");
  });

  it("returns empty string for empty segments", () => {
    expect(getOriginalText(emptyDiff)).toBe("");
  });

  it("returns empty string when all segments are added", () => {
    const allAdded: DiffSegment[] = [
      { text: "hello ", kind: "added" },
      { text: "world", kind: "added" },
    ];
    expect(getOriginalText(allAdded)).toBe("");
  });
});

describe("getImprovedText", () => {
  it("reconstructs improved from unchanged + added", () => {
    expect(getImprovedText(sampleDiff)).toBe("I don't want");
  });

  it("returns full text when no changes", () => {
    expect(getImprovedText(identicalDiff)).toBe("Hello, world!");
  });

  it("returns empty string for empty segments", () => {
    expect(getImprovedText(emptyDiff)).toBe("");
  });

  it("returns empty string when all segments are removed", () => {
    const allRemoved: DiffSegment[] = [
      { text: "hello ", kind: "removed" },
      { text: "world", kind: "removed" },
    ];
    expect(getImprovedText(allRemoved)).toBe("");
  });
});

describe("countChanges", () => {
  it("counts added and removed segments correctly", () => {
    const result = countChanges(sampleDiff);
    expect(result.added).toBe(2);
    expect(result.removed).toBe(2);
  });

  it("returns zero counts when no changes", () => {
    const result = countChanges(identicalDiff);
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
  });

  it("returns zero counts for empty segments", () => {
    const result = countChanges(emptyDiff);
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
  });

  it("counts only added when no removals", () => {
    const onlyAdded: DiffSegment[] = [
      { text: "a", kind: "added" },
      { text: "b", kind: "added" },
      { text: "c", kind: "unchanged" },
    ];
    const result = countChanges(onlyAdded);
    expect(result.added).toBe(2);
    expect(result.removed).toBe(0);
  });
});
