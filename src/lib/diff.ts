// Frontend diff utility functions for Channely

export interface DiffSegment {
  text: string;
  kind: "unchanged" | "added" | "removed";
}

/** Check if there are any actual changes in the diff segments */
export function hasChanges(segments: DiffSegment[]): boolean {
  return segments.some((s) => s.kind !== "unchanged");
}

/** Reconstruct the original text from diff segments (unchanged + removed) */
export function getOriginalText(segments: DiffSegment[]): string {
  return segments
    .filter((s) => s.kind !== "added")
    .map((s) => s.text)
    .join("");
}

/** Reconstruct the improved text from diff segments (unchanged + added) */
export function getImprovedText(segments: DiffSegment[]): string {
  return segments
    .filter((s) => s.kind !== "removed")
    .map((s) => s.text)
    .join("");
}

/** Count the number of added and removed segments */
export function countChanges(segments: DiffSegment[]): {
  added: number;
  removed: number;
} {
  let added = 0;
  let removed = 0;
  for (const s of segments) {
    if (s.kind === "added") added++;
    if (s.kind === "removed") removed++;
  }
  return { added, removed };
}
