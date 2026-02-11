import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface GeneralConfig {
  launch_at_login: boolean;
  theme: string;
  show_menubar_icon: boolean;
  onboarding_completed: boolean;
}

export interface HotkeyConfig {
  trigger: string;
  accept: string;
  dismiss: string;
}

export interface AIConfig {
  api_key: string;
  model: string;
  reasoning_effort: string;
  max_completion_tokens: number;
  timeout_seconds: number;
  default_style: string;
}

export interface UIConfig {
  overlay_position: string;
  show_diff: boolean;
  auto_dismiss_seconds: number;
  animations: boolean;
}

export interface AppConfig {
  general: GeneralConfig;
  hotkey: HotkeyConfig;
  ai: AIConfig;
  ui: UIConfig;
}

export const DEFAULT_CONFIG: AppConfig = {
  general: {
    launch_at_login: true,
    theme: "system",
    show_menubar_icon: true,
    onboarding_completed: false,
  },
  hotkey: {
    trigger: "Cmd+Shift+K",
    accept: "Tab",
    dismiss: "Escape",
  },
  ai: {
    api_key: "",
    model: "gpt-oss-120b",
    reasoning_effort: "high",
    max_completion_tokens: 32768,
    timeout_seconds: 30,
    default_style: "casual",
  },
  ui: {
    overlay_position: "cursor",
    show_diff: true,
    auto_dismiss_seconds: 0,
    animations: true,
  },
};

export type SettingsTab = "general" | "cerebras" | "hotkeys" | "style" | "about";

export interface SettingsState {
  config: AppConfig | null;
  loading: boolean;
  saving: boolean;
  activeTab: SettingsTab;

  loadSettings: () => Promise<void>;
  updateSettings: (updater: (config: AppConfig) => AppConfig) => Promise<void>;
  markOnboardingCompleted: () => Promise<void>;
  setActiveTab: (tab: SettingsTab) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  config: null,
  loading: false,
  saving: false,
  activeTab: "general",

  loadSettings: async () => {
    set({ loading: true });
    try {
      const config = await invoke<AppConfig>("get_settings");
      if (!config || typeof config !== "object") {
        throw new Error("Invalid settings payload");
      }
      set({ config, loading: false });
    } catch {
      // Use defaults on error (e.g., in tests or first run)
      set({ config: structuredClone(DEFAULT_CONFIG), loading: false });
    }
  },

  updateSettings: async (updater) => {
    const current = get().config;
    if (!current) return;

    const updated = updater(current);
    set({ config: updated, saving: true });

    try {
      await invoke("update_settings", { settings: updated });
    } catch {
      // Revert on error
      set({ config: current });
    } finally {
      set({ saving: false });
    }
  },

  markOnboardingCompleted: async () => {
    const current = get().config;
    if (current?.general.onboarding_completed) return;

    await get().updateSettings((c) => ({
      ...c,
      general: { ...c.general, onboarding_completed: true },
    }));
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
}));
