import { useSettingsStore } from "@/stores/settingsStore";
import { Kbd } from "@/components/ui/Kbd";

export function HotkeyTab() {
  const { config } = useSettingsStore();

  if (!config) return null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-1">Hotkeys</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Keyboard shortcuts for triggering and controlling Channely.
        </p>
      </div>

      {/* Trigger Hotkey */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Trigger
        </h3>
        <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
          <div>
            <p className="text-sm font-medium">Proofread selection</p>
            <p className="text-xs text-neutral-400 mt-0.5">
              Select text in any app, then press this shortcut
            </p>
          </div>
          <div className="flex items-center gap-1">
            {config.hotkey.trigger.split("+").map((key, i) => (
              <Kbd key={i}>{key === "Cmd" ? "⌘" : key === "Shift" ? "⇧" : key}</Kbd>
            ))}
          </div>
        </div>
      </section>

      {/* Accept / Dismiss */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Overlay Actions
        </h3>

        <div className="space-y-2">
          <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
            <div>
              <p className="text-sm font-medium">Accept suggestion</p>
              <p className="text-xs text-neutral-400 mt-0.5">
                Replace selected text with the improved version
              </p>
            </div>
            <Kbd>{config.hotkey.accept === "Tab" ? "⇥ Tab" : config.hotkey.accept}</Kbd>
          </div>

          <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
            <div>
              <p className="text-sm font-medium">Dismiss</p>
              <p className="text-xs text-neutral-400 mt-0.5">
                Close the overlay without making changes
              </p>
            </div>
            <Kbd>{config.hotkey.dismiss === "Escape" ? "⎋ Esc" : config.hotkey.dismiss}</Kbd>
          </div>
        </div>
      </section>

      {/* Note */}
      <p className="text-xs text-neutral-400 dark:text-neutral-500">
        Custom hotkey recording will be available in a future update.
      </p>
    </div>
  );
}
