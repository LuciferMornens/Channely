import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Cpu, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useSettingsStore } from "@/stores/settingsStore";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const EFFORT_OPTIONS = [
  { value: "low", label: "Low", desc: "Faster, less thorough" },
  { value: "medium", label: "Medium", desc: "Balanced speed and quality" },
  { value: "high", label: "High", desc: "Thorough, best quality" },
] as const;

export function AIProviderTab() {
  const { config, updateSettings } = useSettingsStore();
  const [testing, setTesting] = useState(false);

  if (!config) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      await invoke<boolean>("test_connection");
      toast.success("Connection successful", {
        description: "Cerebras API is reachable and your key is valid.",
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
    } catch (err) {
      toast.error("Connection failed", {
        description:
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "Could not connect to Cerebras API.",
        icon: <XCircle className="h-4 w-4" />,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-1">Cerebras</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Configure the Cerebras Inference API connection.
        </p>
      </div>

      {/* Model info */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Model
        </h3>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
          <Cpu className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-mono font-medium">
            {config.ai.model}
          </span>
          <span className="text-xs text-neutral-400 ml-auto">
            Cerebras Inference
          </span>
        </div>
      </section>

      {/* API Key */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Authentication
        </h3>
        <Input
          label="API Key"
          type="password"
          showPasswordToggle
          placeholder="csk-..."
          description="Used for Cerebras requests. Saved in Channely settings."
          value={config.ai.api_key}
          onChange={(e) =>
            updateSettings((c) => ({
              ...c,
              ai: { ...c.ai, api_key: e.target.value },
            }))
          }
        />
      </section>

      {/* Reasoning Effort */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Reasoning Effort
        </h3>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Reasoning effort">
          {EFFORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={config.ai.reasoning_effort === opt.value}
              onClick={() =>
                updateSettings((c) => ({
                  ...c,
                  ai: { ...c.ai, reasoning_effort: opt.value },
                }))
              }
              className={`
                flex flex-col items-center gap-1 px-3 py-3 rounded-lg border text-sm transition-colors duration-150
                ${
                  config.ai.reasoning_effort === opt.value
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:border-blue-400"
                }
              `.trim()}
            >
              <span className="font-medium">{opt.label}</span>
              <span
                className={`text-[11px] ${
                  config.ai.reasoning_effort === opt.value
                    ? "text-blue-100"
                    : "text-neutral-400"
                }`}
              >
                {opt.desc}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Max Completion Tokens */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Limits
        </h3>
        <div>
          <label className="block text-sm font-medium mb-1">
            Max completion tokens
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1024}
              max={32768}
              step={1024}
              value={config.ai.max_completion_tokens}
              onChange={(e) =>
                updateSettings((c) => ({
                  ...c,
                  ai: {
                    ...c.ai,
                    max_completion_tokens: Number(e.target.value),
                  },
                }))
              }
              className="flex-1 accent-blue-500"
            />
            <span className="text-sm font-mono w-16 text-right tabular-nums">
              {config.ai.max_completion_tokens.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Includes reasoning tokens. Range: 1,024 – 32,768.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Timeout (seconds)
          </label>
          <input
            type="number"
            min={5}
            max={120}
            value={config.ai.timeout_seconds}
            onChange={(e) =>
              updateSettings((c) => ({
                ...c,
                ai: { ...c.ai, timeout_seconds: Number(e.target.value) },
              }))
            }
            className="w-24 px-3 py-1.5 text-sm rounded-lg border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-600 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </section>

      {/* Test Connection */}
      <section>
        <Button
          onClick={handleTestConnection}
          loading={testing}
          variant="secondary"
          size="md"
        >
          Test Connection
        </Button>
      </section>
    </div>
  );
}
