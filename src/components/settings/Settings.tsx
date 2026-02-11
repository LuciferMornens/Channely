import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings as SettingsIcon, Cpu, Keyboard, Palette, Info } from "lucide-react";
import { Toaster } from "sonner";
import { useSettingsStore, type SettingsTab } from "@/stores/settingsStore";
import { useTheme } from "@/hooks/useTheme";
import { GeneralTab } from "./GeneralTab";
import { AIProviderTab } from "./AIProviderTab";
import { HotkeyTab } from "./HotkeyTab";
import { StyleTab } from "./StyleTab";
import { AboutTab } from "./AboutTab";

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "General", icon: SettingsIcon },
  { id: "cerebras", label: "Cerebras", icon: Cpu },
  { id: "hotkeys", label: "Hotkeys", icon: Keyboard },
  { id: "style", label: "Style", icon: Palette },
  { id: "about", label: "About", icon: Info },
];

const TAB_COMPONENTS: Record<SettingsTab, React.ComponentType> = {
  general: GeneralTab,
  cerebras: AIProviderTab,
  hotkeys: HotkeyTab,
  style: StyleTab,
  about: AboutTab,
};

export function Settings() {
  const { config, loading, activeTab, loadSettings, setActiveTab } =
    useSettingsStore();
  const { isDark } = useTheme();

  // Apply dark class
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Prevent Cmd+Shift+K from propagating (global hotkey) — avoids webview default
  // handlers that could close the app when this window receives focus.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === "k" || e.key === "K")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, []);

  const ActiveComponent = TAB_COMPONENTS[activeTab];

  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
      {/* Sidebar */}
      <nav
        className="w-48 shrink-0 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-900/50 p-3 pt-6 flex flex-col gap-0.5"
        aria-label="Settings sections"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              data-tab={tab.id}
              aria-current={isActive ? "page" : undefined}
              className={`
                relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium
                transition-colors duration-150 text-left w-full
                ${
                  isActive
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60"
                }
              `.trim()}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-lg bg-blue-50 dark:bg-blue-500/10"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className="h-4 w-4 relative z-10" />
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6 pt-8">
        {loading || !config ? (
          <div className="flex items-center justify-center h-full text-neutral-400">
            Loading…
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="max-w-lg"
            >
              <ActiveComponent />
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <Toaster
        position="bottom-right"
        theme={isDark ? "dark" : "light"}
        richColors
        closeButton
      />
    </div>
  );
}
