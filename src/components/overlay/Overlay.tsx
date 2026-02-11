import { useCallback, useEffect, useRef, type MouseEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { DiffView } from "@/components/overlay/DiffView";
import { StyleSelector } from "@/components/overlay/StyleSelector";
import { ActionBar } from "@/components/overlay/ActionBar";
import { useOverlayStore } from "@/stores/overlayStore";
import { shouldStartWindowDrag } from "@/lib/windowDrag";

/* ── Motion presets ──────────────────────────────────────── */

const SPRING_IN = {
  type: "spring" as const,
  stiffness: 380,
  damping: 28,
  mass: 0.85,
};

interface OverlayProps {
  onAccept?: () => void;
  onDismiss?: () => void;
  onStyleChange?: (style: string) => void;
  animationsEnabled?: boolean;
}

/** Main floating overlay — composition of all sub-components */
export function Overlay({
  onAccept,
  onDismiss,
  onStyleChange,
  animationsEnabled = true,
}: OverlayProps) {
  const { visible, loading, error, segments, style, improvedText } =
    useOverlayStore();
  const reduceMotion = useReducedMotion();
  const shouldAnimate = animationsEnabled && !reduceMotion;
  const acceptArmedKey = useRef<"Tab" | "Enter" | null>(null);

  const handleAccept = useCallback(() => {
    onAccept?.();
  }, [onAccept]);

  const handleDismiss = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  const handleStyleChange = useCallback(
    (newStyle: string) => {
      onStyleChange?.(newStyle);
    },
    [onStyleChange],
  );

  const handleWindowDrag = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      if (!shouldStartWindowDrag(event.target)) return;

      void (async () => {
        try {
          await getCurrentWindow().startDragging();
        } catch {
          // Not in Tauri context
        }
      })();
    },
    [],
  );

  // Keyboard handling: Tab/Enter → accept, Esc → dismiss
  useEffect(() => {
    if (!visible) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === "k" || e.key === "K")
      ) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // Cmd+Q / Ctrl+Q → quit the app entirely
      if ((e.metaKey || e.ctrlKey) && (e.key === "q" || e.key === "Q")) {
        e.preventDefault();
        e.stopPropagation();
        void invoke("quit_app").catch(() => {});
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) {
          acceptArmedKey.current = e.key;
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleDismiss();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (acceptArmedKey.current === e.key) {
          acceptArmedKey.current = null;
          handleAccept();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp, { capture: true });
      acceptArmedKey.current = null;
    };
  }, [visible, handleAccept, handleDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          onMouseDown={handleWindowDrag}
          initial={shouldAnimate ? { opacity: 0, scale: 0.92, y: 10, filter: "blur(4px)" } : false}
          animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
          exit={shouldAnimate ? { opacity: 0, scale: 0.97, y: 6, filter: "blur(2px)" } : { opacity: 0 }}
          transition={shouldAnimate ? SPRING_IN : { duration: 0 }}
          className="p-px will-change-[transform,opacity]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="overlay-title"
          aria-describedby="overlay-content"
        >
          <GlassPanel variant="overlay">
            {/* ── Drag-friendly header ─────────────────────── */}
            <div className="drag-region flex items-center justify-between px-4 pt-3 pb-2">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-6 w-6 items-center justify-center rounded-[7px] bg-gradient-to-br from-amber-400 to-amber-600 shadow-sm shadow-amber-500/30">
                  <Sparkles
                    size={11}
                    className="text-white"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                </div>
                <span
                  id="overlay-title"
                  className="text-[13px] font-semibold tracking-tight text-neutral-800 dark:text-neutral-100"
                >
                  Channely
                </span>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Close proofreading overlay"
                className="group relative rounded-lg p-1.5 text-neutral-400 transition-all duration-150 hover:bg-neutral-200/70 hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/50 active:scale-95 dark:text-neutral-500 dark:hover:bg-neutral-700/60 dark:hover:text-neutral-300"
              >
                <X size={13} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>

            {/* ── Divider ──────────────────────────────────── */}
            <div className="mx-4 h-px bg-gradient-to-r from-transparent via-neutral-200/70 to-transparent dark:via-white/[0.06]" />

            {/* ── Content area ─────────────────────────────── */}
            <div id="overlay-content" className="min-h-[80px]">
              <AnimatePresence mode="wait">
                {/* Loading — no streaming text yet */}
                {loading && improvedText.length === 0 && (
                  <motion.div
                    key="loading"
                    initial={shouldAnimate ? { opacity: 0, y: 4 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={shouldAnimate ? { opacity: 0, y: -4 } : { opacity: 1 }}
                    transition={{ duration: shouldAnimate ? 0.2 : 0, ease: "easeOut" }}
                    className="flex flex-col items-center justify-center gap-3 px-4 py-10"
                    aria-live="polite"
                  >
                    <div className="relative flex h-10 w-10 items-center justify-center">
                      {/* Glow ring */}
                      <div className="absolute inset-0 rounded-full bg-amber-400/15 dark:bg-amber-400/10" style={{ animation: "glow-pulse 2s ease-in-out infinite" }} />
                      <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800/80">
                        <Loader2
                          size={17}
                          className="animate-spin text-amber-500"
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                    <span className="text-[12px] font-medium tracking-wide text-neutral-400 dark:text-neutral-500">
                      Improving…
                    </span>
                  </motion.div>
                )}

                {/* Loading — streaming preview */}
                {loading && improvedText.length > 0 && (
                  <motion.div
                    key="streaming"
                    initial={shouldAnimate ? { opacity: 0 } : false}
                    animate={{ opacity: 1 }}
                    exit={shouldAnimate ? { opacity: 0 } : { opacity: 1 }}
                    transition={{ duration: shouldAnimate ? 0.15 : 0 }}
                    className="px-4 py-3"
                    aria-live="polite"
                  >
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                      <Loader2
                        size={10}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                      Streaming…
                    </p>
                    <div className="max-h-[180px] overflow-auto rounded-xl border border-neutral-200/60 bg-neutral-50/60 px-3 py-2.5 text-[14px] leading-relaxed text-neutral-700 dark:border-neutral-700/40 dark:bg-neutral-800/40 dark:text-neutral-200">
                      {improvedText}
                      <span
                        className="ml-0.5 inline-block h-[15px] w-[2px] rounded-full bg-amber-400/80 align-middle dark:bg-amber-400/60"
                        style={{ animation: "cursor-blink 1s step-end infinite" }}
                        aria-hidden="true"
                      />
                    </div>
                  </motion.div>
                )}

                {/* Error state */}
                {error && !loading && (
                  <motion.div
                    key="error"
                    initial={shouldAnimate ? { opacity: 0, y: 4 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={shouldAnimate ? { opacity: 0 } : { opacity: 1 }}
                    transition={{ duration: shouldAnimate ? 0.2 : 0, ease: "easeOut" }}
                    className="px-4 py-4"
                    role="alert"
                  >
                    <div className="flex items-start gap-2.5 rounded-xl border border-red-200/60 bg-red-50/80 p-3 dark:border-red-800/40 dark:bg-red-950/30">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/60">
                        <AlertCircle
                          size={12}
                          className="text-red-500 dark:text-red-400"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-red-700 dark:text-red-300">
                          Something went wrong
                        </p>
                        <p className="mt-0.5 text-[12px] leading-relaxed text-red-600/80 dark:text-red-400/80 break-words">
                          {error}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onStyleChange?.(style)}
                      className="mt-2.5 w-full rounded-xl border border-red-200/60 bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-700 transition-all duration-150 hover:bg-red-100 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 dark:border-red-800/40 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                    >
                      Retry
                    </button>
                  </motion.div>
                )}

                {/* Diff result */}
                {!loading && !error && segments.length > 0 && (
                  <motion.div
                    key="diff"
                    initial={shouldAnimate ? { opacity: 0, y: 4 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={shouldAnimate ? { opacity: 0 } : { opacity: 1 }}
                    transition={{ duration: shouldAnimate ? 0.22 : 0, ease: "easeOut" }}
                  >
                    <DiffView segments={segments} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Divider ──────────────────────────────────── */}
            <div className="mx-4 h-px bg-gradient-to-r from-transparent via-neutral-200/70 to-transparent dark:via-white/[0.06]" />

            {/* ── Style selector ────────────────────────────── */}
            <StyleSelector
              activeStyle={style}
              onStyleChange={handleStyleChange}
              disabled={loading}
            />

            {/* ── Divider ──────────────────────────────────── */}
            <div className="mx-4 h-px bg-gradient-to-r from-transparent via-neutral-200/70 to-transparent dark:via-white/[0.06]" />

            {/* ── Action bar ───────────────────────────────── */}
            <ActionBar />
          </GlassPanel>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
