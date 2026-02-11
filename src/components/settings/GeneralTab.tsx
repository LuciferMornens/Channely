import { useSettingsStore } from "@/stores/settingsStore";
import { Toggle } from "@/components/ui/Toggle";

const THEMES = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

const POSITIONS = [
  { value: "cursor", label: "Near Cursor" },
  { value: "center", label: "Center Screen" },
  { value: "top-right", label: "Top Right" },
] as const;

export function GeneralTab() {
  const { config, updateSettings } = useSettingsStore();
  if (!config) return null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-1">General</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Basic app preferences and behavior.
        </p>
      </div>

      {/* Launch at Login */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Startup
        </h3>
        <Toggle
          label="Launch at login"
          description="Automatically start Channely when you log in"
          checked={config.general.launch_at_login}
          onChange={(v) =>
            updateSettings((c) => ({
              ...c,
              general: { ...c.general, launch_at_login: v },
            }))
          }
        />
      </section>

      {/* Theme */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Appearance
        </h3>
        <div>
          <label className="block text-sm font-medium mb-2">Theme</label>
          <div className="flex gap-2">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() =>
                  updateSettings((c) => ({
                    ...c,
                    general: { ...c.general, theme: t.value },
                  }))
                }
                className={`
                  px-4 py-1.5 text-sm rounded-lg border transition-colors duration-150
                  ${
                    config.general.theme === t.value
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:border-blue-400"
                  }
                `.trim()}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Overlay Position */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Overlay
        </h3>
        <div>
          <label className="block text-sm font-medium mb-2">
            Overlay position
          </label>
          <div className="flex gap-2">
            {POSITIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() =>
                  updateSettings((c) => ({
                    ...c,
                    ui: { ...c.ui, overlay_position: p.value },
                  }))
                }
                className={`
                  px-4 py-1.5 text-sm rounded-lg border transition-colors duration-150
                  ${
                    config.ui.overlay_position === p.value
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:border-blue-400"
                  }
                `.trim()}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <Toggle
          label="Show diff"
          description="Highlight changes between original and improved text"
          checked={config.ui.show_diff}
          onChange={(v) =>
            updateSettings((c) => ({
              ...c,
              ui: { ...c.ui, show_diff: v },
            }))
          }
        />

        <Toggle
          label="Animations"
          description="Enable smooth transitions and animations"
          checked={config.ui.animations}
          onChange={(v) =>
            updateSettings((c) => ({
              ...c,
              ui: { ...c.ui, animations: v },
            }))
          }
        />
      </section>
    </div>
  );
}
