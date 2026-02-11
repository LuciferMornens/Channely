import { Coffee, Briefcase, Scissors, Heart } from "lucide-react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface StyleSelectorProps {
  activeStyle: string;
  onStyleChange: (style: string) => void;
  disabled?: boolean;
}

interface StyleOption {
  id: string;
  label: string;
  icon: ReactNode;
}

const STYLES: StyleOption[] = [
  { id: "casual", label: "Casual", icon: <Coffee size={12} strokeWidth={2} /> },
  { id: "professional", label: "Pro", icon: <Briefcase size={12} strokeWidth={2} /> },
  { id: "concise", label: "Concise", icon: <Scissors size={12} strokeWidth={2} /> },
  { id: "friendly", label: "Friendly", icon: <Heart size={12} strokeWidth={2} /> },
];

/** Horizontal row of style preset pill buttons with animated active indicator */
export function StyleSelector({
  activeStyle,
  onStyleChange,
  disabled = false,
}: StyleSelectorProps) {
  return (
    <div
      className="flex items-center gap-1 px-3 py-2"
      role="radiogroup"
      aria-label="Writing style"
    >
      {STYLES.map((style) => {
        const isActive = activeStyle === style.id;
        return (
          <button
            key={style.id}
            type="button"
            onClick={() => onStyleChange(style.id)}
            disabled={disabled}
            role="radio"
            aria-checked={isActive}
            aria-label={`Use ${style.label} style`}
            className={`
              relative inline-flex items-center gap-1.5 rounded-full
              px-3 py-1.5 text-[12px] font-medium
              transition-all duration-200 ease-out
              focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/40
              disabled:opacity-40 disabled:cursor-not-allowed
              ${
                isActive
                  ? "text-neutral-800 dark:text-neutral-100"
                  : "text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100/60 dark:text-neutral-500 dark:hover:bg-white/[0.05] dark:hover:text-neutral-300"
              }
            `.trim()}
          >
            {/* Animated pill background */}
            {isActive && (
              <motion.span
                layoutId="style-pill"
                className="absolute inset-0 rounded-full bg-neutral-100 ring-1 ring-neutral-200/60 shadow-sm dark:bg-white/[0.1] dark:ring-white/[0.08]"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {style.icon}
              {style.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
