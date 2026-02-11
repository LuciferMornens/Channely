import type { DiffSegment } from "@/lib/diff";

interface DiffViewProps {
  segments: DiffSegment[];
}

/** Renders text with inline color-coded diff highlights */
export function DiffView({ segments }: DiffViewProps) {
  return (
    <div className="px-4 py-3" aria-live="polite" aria-label="Proofread diff">
      <div className="text-[14px] leading-[1.9] tracking-[-0.005em]">
        {segments.map((segment, i) => {
          if (segment.kind === "unchanged") {
            return (
              <span
                key={i}
                className="text-neutral-700 dark:text-neutral-300"
              >
                {segment.text}
              </span>
            );
          }

          if (segment.kind === "added") {
            return (
              <ins
                key={i}
                data-testid="diff-added"
                className="diff-segment-enter rounded-[4px] bg-emerald-100/70 px-[3px] py-[1px] text-emerald-700 no-underline dark:bg-emerald-400/[0.12] dark:text-emerald-400"
                style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
              >
                {segment.text}
              </ins>
            );
          }

          if (segment.kind === "removed") {
            return (
              <del
                key={i}
                data-testid="diff-removed"
                className="diff-segment-enter rounded-[4px] bg-red-100/50 px-[3px] py-[1px] text-red-300 line-through decoration-red-300/60 dark:bg-red-400/[0.08] dark:text-red-500/40 dark:decoration-red-500/30"
                style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
              >
                {segment.text}
              </del>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
