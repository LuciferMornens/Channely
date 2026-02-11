import { Kbd } from "@/components/ui/Kbd";

/** Bottom bar showing keyboard shortcut hints */
export function ActionBar() {
  return (
    <div
      className="flex items-center justify-center gap-4 px-4 py-2.5 text-[11px] text-neutral-400 dark:text-neutral-500"
      aria-label="Keyboard shortcuts"
    >
      <span className="inline-flex items-center gap-1.5">
        <Kbd>Tab</Kbd>
        <span className="text-neutral-300 dark:text-neutral-600">/</span>
        <Kbd>↵</Kbd>
        <span className="font-medium text-neutral-500 dark:text-neutral-400">accept</span>
      </span>
      <span className="h-3 w-px bg-neutral-200/80 dark:bg-neutral-700/60" aria-hidden="true" />
      <span className="inline-flex items-center gap-1.5">
        <Kbd>Esc</Kbd>
        <span className="font-medium text-neutral-500 dark:text-neutral-400">dismiss</span>
      </span>
      <span className="h-3 w-px bg-neutral-200/80 dark:bg-neutral-700/60" aria-hidden="true" />
      <span className="inline-flex items-center gap-1.5">
        <Kbd>⌘Q</Kbd>
        <span className="font-medium text-neutral-500 dark:text-neutral-400">quit</span>
      </span>
    </div>
  );
}
