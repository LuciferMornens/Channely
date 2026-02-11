import { motion } from "framer-motion";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  id?: string;
}

/** Animated toggle switch — macOS-style on/off */
export function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
  description,
  id,
}: ToggleProps) {
  const toggleId = id || label?.toLowerCase().replace(/\s+/g, "-") || "toggle";
  const labelId = label ? `${toggleId}-label` : undefined;
  const descriptionId = description ? `${toggleId}-description` : undefined;
  const describedBy = [descriptionId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex items-center justify-between gap-3">
      {(label || description) && (
        <div className="flex-1 min-w-0">
          {label && (
            <label
              htmlFor={toggleId}
              id={labelId}
              className="text-sm font-medium text-neutral-900 dark:text-neutral-100 cursor-pointer"
            >
              {label}
            </label>
          )}
          {description && (
            <p
              id={descriptionId}
              className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5"
            >
              {description}
            </p>
          )}
        </div>
      )}
      <button
        id={toggleId}
        role="switch"
        type="button"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full
          border-2 border-transparent transition-colors duration-200 ease-in-out
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
          disabled:cursor-not-allowed disabled:opacity-50
          ${checked ? "bg-blue-500" : "bg-neutral-200 dark:bg-neutral-700"}
        `.trim()}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={`
            pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md
            ring-0 transform
          `.trim()}
          style={{ x: checked ? 20 : 0 }}
        />
      </button>
    </div>
  );
}
