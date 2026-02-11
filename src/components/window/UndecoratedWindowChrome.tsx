import { useCallback, useState, type MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";

interface UndecoratedWindowChromeProps {
  title?: string;
  className?: string;
  showCloseButton?: boolean;
  showResizeHandle?: boolean;
  onClose?: () => Promise<void> | void;
}

const controlButtonClass =
  "flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-200 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-neutral-100";

export function UndecoratedWindowChrome({
  title = "Window",
  className = "",
  showCloseButton = false,
  showResizeHandle = false,
  onClose,
}: UndecoratedWindowChromeProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  const handleDragStart = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    void (async () => {
      try {
        await getCurrentWindow().startDragging();
      } catch {
        // No-op outside Tauri runtime.
      }
    })();
  }, []);

  const handleMinimize = useCallback(() => {
    void (async () => {
      try {
        await getCurrentWindow().minimize();
      } catch {
        // No-op outside Tauri runtime.
      }
    })();
  }, []);

  const handleToggleMaximize = useCallback(() => {
    void (async () => {
      try {
        const win = getCurrentWindow();
        await win.toggleMaximize();
        const maximized = await win.isMaximized();
        setIsMaximized(maximized);
      } catch {
        // No-op outside Tauri runtime.
      }
    })();
  }, []);

  const handleClose = useCallback(() => {
    if (onClose) {
      void onClose();
      return;
    }

    void (async () => {
      try {
        await getCurrentWindow().hide();
      } catch {
        // No-op outside Tauri runtime.
      }
    })();
  }, [onClose]);

  const handleResizeStart = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      void (async () => {
        try {
          await getCurrentWindow().startResizeDragging("SouthEast");
        } catch {
          // No-op outside Tauri runtime.
        }
      })();
    },
    [],
  );

  return (
    <>
      <div
        data-testid="window-chrome"
        className={`flex items-center gap-2 rounded-xl border border-white/60 bg-white/75 p-1.5 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70 ${className}`.trim()}
      >
        <button
          type="button"
          aria-label="Minimize window"
          className={controlButtonClass}
          onClick={handleMinimize}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          aria-label={isMaximized ? "Restore window" : "Maximize window"}
          className={controlButtonClass}
          onClick={handleToggleMaximize}
        >
          {isMaximized ? (
            <Copy className="h-3.5 w-3.5" />
          ) : (
            <Square className="h-3.5 w-3.5" />
          )}
        </button>

        {showCloseButton && (
          <button
            type="button"
            aria-label="Close window"
            className={controlButtonClass}
            onClick={handleClose}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        <div
          data-testid="window-drag-region"
          data-tauri-drag-region
          className="flex h-7 flex-1 items-center rounded-lg px-2"
          onMouseDown={handleDragStart}
          onDoubleClick={handleToggleMaximize}
        >
          <span className="select-none text-xs font-semibold tracking-[0.08em] text-neutral-600 uppercase dark:text-neutral-300">
            {title}
          </span>
        </div>
      </div>

      {showResizeHandle && (
        <button
          type="button"
          aria-label="Resize window"
          className="fixed right-2 bottom-2 z-30 flex h-6 w-6 cursor-se-resize items-center justify-center rounded-md border border-white/40 bg-white/70 text-neutral-500 shadow backdrop-blur-sm transition-colors hover:text-neutral-800 dark:border-white/15 dark:bg-slate-900/70 dark:text-neutral-300 dark:hover:text-neutral-100"
          onMouseDown={handleResizeStart}
        >
          <span className="block h-3 w-3 border-r-2 border-b-2 border-current" />
        </button>
      )}
    </>
  );
}
