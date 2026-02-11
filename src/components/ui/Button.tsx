import { forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-b from-brand-500 to-brand-600 text-white hover:from-brand-400 hover:to-brand-500 active:from-brand-600 active:to-brand-700 shadow-sm shadow-brand-500/25 ring-1 ring-brand-600/20 dark:ring-brand-400/20",
  secondary:
    "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 active:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700 dark:active:bg-neutral-600 shadow-sm ring-1 ring-neutral-200/60 dark:ring-neutral-700/60",
  ghost:
    "bg-transparent text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:active:bg-neutral-700",
  danger:
    "bg-gradient-to-b from-red-500 to-red-600 text-white hover:from-red-400 hover:to-red-500 active:from-red-600 active:to-red-700 shadow-sm shadow-red-500/25",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-xs rounded-lg",
  md: "px-3.5 py-1.5 text-sm rounded-[10px]",
  lg: "px-5 py-2 text-sm rounded-xl",
};

/** Versatile button with variant, size, and micro-interaction support */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      className = "",
      type = "button",
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center gap-1.5
          font-medium transition-all duration-150
          active:scale-[0.97]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1
          disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${className}
        `.trim()}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
