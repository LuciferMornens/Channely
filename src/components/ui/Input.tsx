import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: string;
  showPasswordToggle?: boolean;
}

/** Styled input with label, description, error, and password toggle */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      description,
      error,
      showPasswordToggle = false,
      type,
      className = "",
      id,
      ...props
    },
    ref,
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-") || undefined;
    const isPassword = type === "password";
    const resolvedType = isPassword && showPassword ? "text" : type;
    const descriptionId = description ? `${inputId}-description` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-neutral-900 dark:text-neutral-100"
          >
            {label}
          </label>
        )}
        {description && (
          <p
            id={descriptionId}
            className="text-xs text-neutral-500 dark:text-neutral-400"
          >
            {description}
          </p>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            className={`
              w-full px-3 py-2 text-sm rounded-xl border
              bg-white dark:bg-neutral-900
              text-neutral-900 dark:text-neutral-100
              border-neutral-200 dark:border-neutral-700
              placeholder:text-neutral-400 dark:placeholder:text-neutral-500
              focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
              ${isPassword && showPasswordToggle ? "pr-9" : ""}
              ${error ? "border-red-400 focus:ring-red-500/50 focus:border-red-500 dark:border-red-600" : ""}
              ${className}
            `.trim()}
            {...props}
          />
          {isPassword && showPasswordToggle && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-300"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
        {error && (
          <p id={errorId} className="text-xs text-red-500">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
