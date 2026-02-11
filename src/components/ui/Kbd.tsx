import type { ReactNode } from "react";

interface KbdProps {
  children: ReactNode;
  className?: string;
}

/** Keyboard shortcut badge — styled like macOS key caps */
export function Kbd({ children, className = "" }: KbdProps) {
  return (
    <kbd
      className={`
        inline-flex items-center justify-center
        min-w-[20px] rounded-[5px] border px-1.5 py-[2px]
        text-[10px] font-semibold font-mono leading-none
        border-neutral-200/80 bg-white text-neutral-500
        dark:border-neutral-600/80 dark:bg-neutral-800 dark:text-neutral-400
        shadow-[0_1px_0_0.5px_rgba(0,0,0,0.06),0_0.5px_0_0_rgba(0,0,0,0.08)]
        dark:shadow-[0_1px_0_0.5px_rgba(255,255,255,0.04),0_0.5px_0_0_rgba(255,255,255,0.06)]
        ${className}
      `.trim()}
    >
      {children}
    </kbd>
  );
}
