import type { ReactNode } from "react";

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  /** Use the heavier overlay variant with deeper blur + brand-tinted border */
  variant?: "default" | "overlay";
}

/** Frosted glass container matching macOS aesthetic */
export function GlassPanel({
  children,
  className = "",
  variant = "default",
}: GlassPanelProps) {
  if (variant === "overlay") {
    return (
      <div
        className={`glass-card-overlay ${className}`.trim()}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={`
        rounded-2xl border shadow-2xl backdrop-blur-xl
        border-white/20 bg-white/80
        dark:border-white/[0.12] dark:bg-neutral-900/85
        ${className}
      `.trim()}
    >
      {children}
    </div>
  );
}
