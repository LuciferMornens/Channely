import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Keyboard,
  Loader2,
  Rocket,
  ShieldCheck,
  Sparkles,
  Zap,
  Lock,
  TestTube,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { UndecoratedWindowChrome } from "@/components/window/UndecoratedWindowChrome";
import { shouldStartWindowDrag } from "@/lib/windowDrag";

type ConnectionStatus = "idle" | "testing" | "success" | "error";

interface OnboardingProps {
  onComplete: () => Promise<void> | void;
  initialApiKey?: string;
  onSaveApiKey?: (apiKey: string) => Promise<void> | void;
}

export function normalizePermissionStatus(status: unknown): boolean {
  return status === true;
}

/* ── Step icon badge ─────────────────────────────────────── */
function StepIcon({ icon: Icon, active }: { icon: React.ElementType; active: boolean }) {
  return (
    <div
      className={`
        flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-300
        ${
          active
            ? "bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-lg shadow-brand-500/25"
            : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500"
        }
      `.trim()}
      style={active ? { animation: "float 3s ease-in-out infinite" } : undefined}
    >
      <Icon size={20} />
    </div>
  );
}

/* ── Animated step content wrapper ───────────────────────── */
const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
    filter: "blur(4px)",
  }),
  center: {
    x: 0,
    opacity: 1,
    filter: "blur(0px)",
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -40 : 40,
    opacity: 0,
    filter: "blur(4px)",
  }),
};

const stepTransition = {
  type: "spring" as const,
  stiffness: 350,
  damping: 32,
  mass: 0.8,
};

export function Onboarding({
  onComplete,
  initialApiKey = "",
  onSaveApiKey,
}: OnboardingProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [checkingPermission, setCheckingPermission] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState(initialApiKey);
  const [apiKeyVerified, setApiKeyVerified] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const steps = useMemo(
    () => [
      "Welcome",
      "Accessibility",
      "API Setup",
      "Test It",
    ],
    [],
  );

  const stepIcons = [Sparkles, Lock, Zap, TestTube];

  const isLastStep = stepIndex === steps.length - 1;

  const checkPermission = useCallback(async () => {
    setCheckingPermission(true);
    try {
      const status = await invoke<unknown>("get_accessibility_permission_status");
      setPermissionGranted(normalizePermissionStatus(status));
    } catch {
      setPermissionGranted(false);
    } finally {
      setCheckingPermission(false);
    }
  }, []);

  useEffect(() => {
    void checkPermission();
  }, [checkPermission]);

  useEffect(() => {
    setApiKeyInput(initialApiKey);
    setApiKeyVerified(false);
  }, [initialApiKey]);

  const handleOpenAccessibilitySettings = async () => {
    try {
      await invoke("open_accessibility_settings");
    } catch {
      // Best effort
    }
  };

  const handleTestConnection = async () => {
    const key = apiKeyInput.trim();
    if (!key) {
      setConnectionStatus("error");
      setConnectionMessage("Please enter your Cerebras API key first.");
      setApiKeyVerified(false);
      return;
    }

    setConnectionStatus("testing");
    setConnectionMessage("");
    try {
      await onSaveApiKey?.(key);
      await invoke<boolean>("test_connection");
      setConnectionStatus("success");
      setConnectionMessage("Cerebras connection is working.");
      setApiKeyVerified(true);
    } catch (err) {
      setConnectionStatus("error");
      setApiKeyVerified(false);
      setConnectionMessage(
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Could not connect to Cerebras. Verify your API key.",
      );
    }
  };

  const handleNext = async () => {
    if (stepIndex === 2 && !apiKeyVerified) {
      setConnectionStatus("error");
      setConnectionMessage("Verify your API key before continuing.");
      return;
    }

    if (!isLastStep) {
      setDirection(1);
      setStepIndex((index) => Math.min(index + 1, steps.length - 1));
      return;
    }

    setFinishing(true);
    try {
      await onComplete();
    } finally {
      setFinishing(false);
    }
  };

  const handleBack = () => {
    setDirection(-1);
    setStepIndex((index) => Math.max(index - 1, 0));
  };

  const handleWindowDrag = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (!shouldStartWindowDrag(event.target)) return;

    void (async () => {
      try {
        await getCurrentWindow().startDragging();
      } catch {
        // Not in Tauri context
      }
    })();
  }, []);

  return (
    <div
      data-testid="onboarding-flow"
      onMouseDown={handleWindowDrag}
      className="relative min-h-screen overflow-hidden bg-[radial-gradient(ellipse_at_10%_0%,rgba(124,77,255,0.15),transparent_50%),radial-gradient(ellipse_at_90%_10%,rgba(99,102,241,0.12),transparent_40%),radial-gradient(ellipse_at_50%_100%,rgba(124,77,255,0.08),transparent_50%),linear-gradient(to_bottom,#fafafa,#f4f4f5)] p-4 dark:bg-[radial-gradient(ellipse_at_10%_0%,rgba(124,77,255,0.20),transparent_50%),radial-gradient(ellipse_at_90%_10%,rgba(99,102,241,0.15),transparent_40%),radial-gradient(ellipse_at_50%_100%,rgba(124,77,255,0.10),transparent_50%),linear-gradient(to_bottom,#09090b,#18181b)]"
    >
      <UndecoratedWindowChrome
        title="Channely Setup"
        className="mx-auto mb-3 w-full max-w-[540px]"
        showResizeHandle
      />

      <div className="glass-card mx-auto w-full max-w-[540px] p-6">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 shadow-sm shadow-brand-500/20">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">
              Channely Setup
            </p>
          </div>
          <p className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-brand-600 ring-1 ring-brand-200/60 dark:bg-brand-950/40 dark:text-brand-300 dark:ring-brand-700/40">
            Step {stepIndex + 1} of {steps.length}
          </p>
        </header>

        {/* Progress indicator */}
        <ol className="mb-8 grid grid-cols-4 gap-2">
          {steps.map((step, index) => {
            const isActive = index === stepIndex;
            const isDone = index < stepIndex;
            return (
              <li key={step} className="space-y-1.5">
                <div className="relative h-1.5 overflow-hidden rounded-full bg-neutral-200/70 dark:bg-neutral-700/50">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-400 to-brand-500"
                    initial={false}
                    animate={{
                      width: isDone ? "100%" : isActive ? "50%" : "0%",
                    }}
                    transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                  />
                </div>
                <p
                  className={`
                    text-[11px] font-medium transition-colors duration-200
                    ${
                      isActive
                        ? "text-brand-600 dark:text-brand-300"
                        : isDone
                          ? "text-neutral-600 dark:text-neutral-300"
                          : "text-neutral-400 dark:text-neutral-500"
                    }
                  `.trim()}
                >
                  {step}
                </p>
              </li>
            );
          })}
        </ol>

        {/* Step content — animated transitions */}
        <section className="relative min-h-[220px] overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={stepIndex}
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={stepTransition}
            >
              {/* ── Step 0: Welcome ─────────────────────────────── */}
              {stepIndex === 0 && (
                <div className="space-y-4">
                  <StepIcon icon={stepIcons[0]} active />
                  <h1 className="text-gradient text-2xl font-bold tracking-tight">
                    Welcome to Channely
                  </h1>
                  <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                    AI-powered text improvement that works everywhere on your Mac.
                    Select text in any app, press{" "}
                    <kbd className="rounded-md border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-brand-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-brand-300">
                      ⌘⇧K
                    </kbd>
                    , and get instant corrections.
                  </p>
                  <div className="flex items-start gap-3 rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 dark:border-brand-800/30 dark:bg-brand-950/20">
                    <Zap className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                    <p className="text-[13px] leading-relaxed text-brand-800 dark:text-brand-200">
                      Setup takes about one minute. We will check Accessibility access,
                      verify your API connectivity, and then run a quick test.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Step 1: Accessibility ──────────────────────── */}
              {stepIndex === 1 && (
                <div className="space-y-4">
                  <StepIcon icon={stepIcons[1]} active />
                  <h2 className="text-gradient text-2xl font-bold tracking-tight">
                    Accessibility Permission
                  </h2>
                  <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                    Channely needs Accessibility access to copy selected text and
                    paste improved text back into your current app.
                  </p>
                  <motion.div
                    className={`
                      flex items-center gap-3 rounded-xl border p-3 transition-colors
                      ${
                        permissionGranted
                          ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-800/40 dark:bg-emerald-950/20"
                          : "border-amber-200 bg-amber-50/70 dark:border-amber-800/40 dark:bg-amber-950/20"
                      }
                    `.trim()}
                    layout
                    transition={{ duration: 0.25 }}
                  >
                    <div className="relative">
                      {permissionGranted && (
                        <motion.div
                          className="absolute -inset-1 rounded-full"
                          style={{ animation: "pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        />
                      )}
                      <ShieldCheck
                        className={`
                          relative h-5 w-5 transition-colors duration-300
                          ${permissionGranted ? "text-emerald-500" : "text-amber-500"}
                        `.trim()}
                      />
                    </div>
                    <span className={`text-sm font-medium ${permissionGranted ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
                      Status:{" "}
                      {permissionGranted ? "Granted ✓" : "Not granted yet"}
                    </span>
                  </motion.div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleOpenAccessibilitySettings}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open Accessibility Settings
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void checkPermission()}
                      loading={checkingPermission}
                    >
                      Check Again
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Step 2: API Setup ──────────────────────────── */}
              {stepIndex === 2 && (
                <div className="space-y-4">
                  <StepIcon icon={stepIcons[2]} active />
                  <h2 className="text-gradient text-2xl font-bold tracking-tight">
                    API Setup
                  </h2>
                  <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                    Enter your Cerebras API key and verify the connection. Channely
                    will use this key directly — it never leaves your machine.
                  </p>
                  <Input
                    label="Cerebras API key"
                    type="password"
                    showPasswordToggle
                    placeholder="csk-..."
                    value={apiKeyInput}
                    onChange={(event) => {
                      setApiKeyInput(event.target.value);
                      setApiKeyVerified(false);
                      if (connectionStatus !== "testing") {
                        setConnectionStatus("idle");
                        setConnectionMessage("");
                      }
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void handleTestConnection()}
                      loading={connectionStatus === "testing"}
                    >
                      Test Connection
                    </Button>
                    {apiKeyVerified && (
                      <motion.span
                        data-testid="api-verified-badge"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200/60 dark:bg-emerald-900/40 dark:text-emerald-300 dark:ring-emerald-700/40"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Verified
                      </motion.span>
                    )}
                    {connectionStatus !== "idle" && (
                      <span
                        className={`
                          text-xs font-medium transition-colors
                          ${
                            connectionStatus === "success"
                              ? "text-emerald-600 dark:text-emerald-300"
                              : connectionStatus === "error"
                                ? "text-red-600 dark:text-red-300"
                                : "text-neutral-500 dark:text-neutral-400"
                          }
                        `.trim()}
                      >
                        {connectionStatus === "testing" ? "Testing..." : connectionMessage}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* ── Step 3: Test It ────────────────────────────── */}
              {stepIndex === 3 && (
                <div className="space-y-4">
                  <StepIcon icon={stepIcons[3]} active />
                  <h2 className="text-gradient text-2xl font-bold tracking-tight">
                    Test It
                  </h2>
                  <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                    Try this sample text in any app and press the hotkey.
                  </p>
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 font-mono text-sm leading-relaxed text-neutral-600 italic shadow-sm dark:border-neutral-700 dark:bg-neutral-900/70 dark:text-neutral-300">
                    i dont have time for this because its too many small mistakes
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl border border-emerald-200/60 bg-emerald-50/60 p-4 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                    <Keyboard className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                        Press Cmd+Shift+K
                      </p>
                      <p className="mt-1 text-[13px] text-emerald-700/80 dark:text-emerald-300/80">
                        Accept with Tab or Enter. Dismiss with Escape.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </section>

        {/* Footer navigation */}
        <footer className="mt-8 flex items-center justify-between border-t border-neutral-200/60 pt-4 dark:border-neutral-800/60">
          <Button
            type="button"
            variant="ghost"
            onClick={handleBack}
            disabled={stepIndex === 0}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>

          <Button
            type="button"
            onClick={() => void handleNext()}
            loading={finishing}
            disabled={stepIndex === 2 && !apiKeyVerified}
          >
            {isLastStep ? (
              <>
                <Rocket className="h-3.5 w-3.5" />
                Finish Setup
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </footer>
      </div>

      {checkingPermission && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-brand-200/40 bg-white/80 px-3 py-1.5 text-xs text-brand-600 shadow-lg backdrop-blur dark:border-brand-700/30 dark:bg-slate-900/80 dark:text-brand-300"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Checking permission...
        </motion.div>
      )}
    </div>
  );
}
