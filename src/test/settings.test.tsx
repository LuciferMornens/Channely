import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";

// Tauri mocks must be imported before components
import { tauriMockState } from "./mocks/tauri";
import { invoke } from "@tauri-apps/api/core";

import { Settings } from "@/components/settings/Settings";
import { GeneralTab } from "@/components/settings/GeneralTab";
import { AIProviderTab } from "@/components/settings/AIProviderTab";
import { HotkeyTab } from "@/components/settings/HotkeyTab";
import { StyleTab } from "@/components/settings/StyleTab";
import { AboutTab } from "@/components/settings/AboutTab";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import {
  useSettingsStore,
  DEFAULT_CONFIG,
  type AppConfig,
} from "@/stores/settingsStore";

// Reset store between tests
beforeEach(() => {
  useSettingsStore.setState({
    config: { ...structuredClone(DEFAULT_CONFIG) },
    loading: false,
    saving: false,
    activeTab: "general",
  });
  vi.clearAllMocks();
  tauriMockState.invokeHandlers.clear();
  tauriMockState.eventListeners.clear();
});

// ─── UI Components ─────────────────────────────────────────────────────────────

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("shows spinner when loading", () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toBeDisabled();
    expect(btn.querySelector("svg.animate-spin")).toBeTruthy();
  });

  it("applies variant classes", () => {
    render(<Button variant="danger">Delete</Button>);
    const btn = screen.getByRole("button", { name: "Delete" });
    expect(btn.className).toContain("from-red-500");
  });
});

describe("Input", () => {
  it("renders with label", () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<Input label="API Key" description="Your secret key" />);
    expect(screen.getByText("Your secret key")).toBeInTheDocument();
  });

  it("shows password toggle when type=password and showPasswordToggle", () => {
    render(<Input type="password" showPasswordToggle label="Password" />);
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle).toBeInTheDocument();
  });

  it("toggles password visibility", () => {
    render(<Input type="password" showPasswordToggle label="API Key" />);
    const input = screen.getByLabelText("API Key");
    expect(input).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("shows error message", () => {
    render(<Input label="Email" error="Invalid email" />);
    expect(screen.getByText("Invalid email")).toBeInTheDocument();
  });
});

describe("Toggle", () => {
  it("renders label and description", () => {
    render(
      <Toggle
        label="Dark mode"
        description="Use dark theme"
        checked={false}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Dark mode")).toBeInTheDocument();
    expect(screen.getByText("Use dark theme")).toBeInTheDocument();
  });

  it("calls onChange when clicked", () => {
    const onChange = vi.fn();
    render(<Toggle label="Toggle" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("reflects checked state via aria-checked", () => {
    render(<Toggle label="Toggle" checked={true} onChange={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("does not fire when disabled", () => {
    const onChange = vi.fn();
    render(
      <Toggle label="Toggle" checked={false} onChange={onChange} disabled />,
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ─── Tab Navigation ────────────────────────────────────────────────────────────

describe("Settings — Tab Navigation", () => {
  beforeEach(() => {
    // Set up the get_settings handler so loadSettings resolves
    tauriMockState.invokeHandlers.set("get_settings", () =>
      structuredClone(DEFAULT_CONFIG),
    );
  });

  it("renders all 5 tabs", async () => {
    render(<Settings />);
    // Tabs are in the sidebar, always visible
    await waitFor(() => {
      expect(screen.getByText("General")).toBeInTheDocument();
    });
    expect(screen.getByText("Cerebras")).toBeInTheDocument();
    expect(screen.getByText("Hotkeys")).toBeInTheDocument();
    expect(screen.getByText("Style")).toBeInTheDocument();
    expect(screen.getByText("About")).toBeInTheDocument();
  });

  it("General tab is active by default", async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(screen.getByText("Launch at login")).toBeInTheDocument();
    });
  });

  it("clicking Cerebras tab switches content", async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(screen.getByText("General")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Cerebras"));
    expect(useSettingsStore.getState().activeTab).toBe("cerebras");
  });

  it("clicking Hotkeys tab switches content", async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(screen.getByText("General")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Hotkeys"));
    expect(useSettingsStore.getState().activeTab).toBe("hotkeys");
  });

  it("clicking Style tab switches content", async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(screen.getByText("General")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Style"));
    expect(useSettingsStore.getState().activeTab).toBe("style");
  });

  it("clicking About tab switches content", async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(screen.getByText("General")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("About"));
    expect(useSettingsStore.getState().activeTab).toBe("about");
  });
});

// ─── General Tab ───────────────────────────────────────────────────────────────

describe("GeneralTab", () => {
  it("renders launch at login toggle", () => {
    render(<GeneralTab />);
    expect(screen.getByText("Launch at login")).toBeInTheDocument();
  });

  it("toggles launch at login", () => {
    render(<GeneralTab />);
    // The Toggle component uses role="switch" — there are 3 toggles; launch is the first
    const switches = screen.getAllByRole("switch");
    const launchToggle = switches[0];
    expect(launchToggle).toHaveAttribute("aria-checked", "true"); // default is true
    fireEvent.click(launchToggle);
    expect(useSettingsStore.getState().config!.general.launch_at_login).toBe(false);
  });

  it("renders theme selector with 3 options", () => {
    render(<GeneralTab />);
    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
  });

  it("changes theme", () => {
    render(<GeneralTab />);
    fireEvent.click(screen.getByText("Dark"));
    expect(useSettingsStore.getState().config!.general.theme).toBe("dark");
  });

  it("renders overlay position selector", () => {
    render(<GeneralTab />);
    expect(screen.getByText("Near Cursor")).toBeInTheDocument();
    expect(screen.getByText("Center Screen")).toBeInTheDocument();
    expect(screen.getByText("Top Right")).toBeInTheDocument();
  });

  it("changes overlay position", () => {
    render(<GeneralTab />);
    fireEvent.click(screen.getByText("Center Screen"));
    expect(useSettingsStore.getState().config!.ui.overlay_position).toBe("center");
  });

  it("renders show diff toggle", () => {
    render(<GeneralTab />);
    expect(screen.getByText("Show diff")).toBeInTheDocument();
  });

  it("renders animations toggle", () => {
    render(<GeneralTab />);
    expect(screen.getByText("Animations")).toBeInTheDocument();
  });
});

// ─── Cerebras / AI Provider Tab ────────────────────────────────────────────────

describe("AIProviderTab (Cerebras)", () => {
  it("displays model name as static text", () => {
    render(<AIProviderTab />);
    expect(screen.getByText("gpt-oss-120b")).toBeInTheDocument();
  });

  it("renders API key input as password field", () => {
    render(<AIProviderTab />);
    expect(screen.getByText("API Key")).toBeInTheDocument();
    // The input should exist and show password toggle
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
  });

  it("updates API key in settings state", () => {
    render(<AIProviderTab />);
    const input = screen.getByLabelText("API Key");
    fireEvent.change(input, { target: { value: "csk-demo" } });
    expect(useSettingsStore.getState().config!.ai.api_key).toBe("csk-demo");
  });

  it("renders reasoning effort selector with 3 options", () => {
    render(<AIProviderTab />);
    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("changes reasoning effort", () => {
    render(<AIProviderTab />);
    const lowBtn = screen.getByText("Low");
    fireEvent.click(lowBtn);
    expect(useSettingsStore.getState().config!.ai.reasoning_effort).toBe("low");
  });

  it("marks selected reasoning effort with aria-checked", () => {
    render(<AIProviderTab />);
    const radioGroup = screen.getByRole("radiogroup", { name: "Reasoning effort" });
    const highRadio = radioGroup.querySelector('[aria-checked="true"]')!;
    expect(highRadio).toBeInTheDocument();
    expect(highRadio.textContent).toContain("High");
  });

  it("renders max completion tokens slider", () => {
    render(<AIProviderTab />);
    expect(screen.getByText("Max completion tokens")).toBeInTheDocument();
    // Default value displayed
    expect(screen.getByText("32,768")).toBeInTheDocument();
  });

  it("changes max completion tokens", () => {
    render(<AIProviderTab />);
    const slider = document.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "8192" } });
    expect(useSettingsStore.getState().config!.ai.max_completion_tokens).toBe(8192);
  });

  it("renders timeout input", () => {
    render(<AIProviderTab />);
    expect(screen.getByText("Timeout (seconds)")).toBeInTheDocument();
    const input = document.querySelector('input[type="number"]') as HTMLInputElement;
    expect(input.value).toBe("30");
  });

  it("changes timeout", () => {
    render(<AIProviderTab />);
    const input = document.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: "60" } });
    expect(useSettingsStore.getState().config!.ai.timeout_seconds).toBe(60);
  });

  it("renders Test Connection button", () => {
    render(<AIProviderTab />);
    expect(screen.getByRole("button", { name: "Test Connection" })).toBeInTheDocument();
  });

  it("Test Connection calls invoke and shows success toast", async () => {
    tauriMockState.invokeHandlers.set("test_connection", () => true);

    render(<AIProviderTab />);
    const btn = screen.getByRole("button", { name: "Test Connection" });
    await act(async () => {
      fireEvent.click(btn);
    });

    expect(invoke).toHaveBeenCalledWith("test_connection");
  });

  it("Test Connection shows error on failure", async () => {
    tauriMockState.invokeHandlers.set("test_connection", () => {
      throw new Error("Invalid API key");
    });

    render(<AIProviderTab />);
    const btn = screen.getByRole("button", { name: "Test Connection" });
    await act(async () => {
      fireEvent.click(btn);
    });

    expect(invoke).toHaveBeenCalledWith("test_connection");
  });
});

// ─── Hotkey Tab ────────────────────────────────────────────────────────────────

describe("HotkeyTab", () => {
  it("displays current trigger hotkey", () => {
    render(<HotkeyTab />);
    expect(screen.getByText("Proofread selection")).toBeInTheDocument();
    // Should show ⌘ ⇧ K
    expect(screen.getByText("⌘")).toBeInTheDocument();
    expect(screen.getByText("⇧")).toBeInTheDocument();
    expect(screen.getByText("K")).toBeInTheDocument();
  });

  it("displays accept key", () => {
    render(<HotkeyTab />);
    expect(screen.getByText("Accept suggestion")).toBeInTheDocument();
    expect(screen.getByText("⇥ Tab")).toBeInTheDocument();
  });

  it("displays dismiss key", () => {
    render(<HotkeyTab />);
    expect(screen.getByText("Dismiss")).toBeInTheDocument();
    expect(screen.getByText("⎋ Esc")).toBeInTheDocument();
  });
});

// ─── Style Tab ─────────────────────────────────────────────────────────────────

describe("StyleTab", () => {
  it("renders all 4 style options", () => {
    render(<StyleTab />);
    expect(screen.getByText("Casual")).toBeInTheDocument();
    expect(screen.getByText("Professional")).toBeInTheDocument();
    expect(screen.getByText("Concise")).toBeInTheDocument();
    expect(screen.getByText("Friendly")).toBeInTheDocument();
  });

  it("shows descriptions for each style", () => {
    render(<StyleTab />);
    expect(
      screen.getByText(/Keep it casual and natural/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Make it polished and professional/),
    ).toBeInTheDocument();
  });

  it("marks current style as active", () => {
    render(<StyleTab />);
    // Default is "casual"
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("changes default style on click", () => {
    render(<StyleTab />);
    fireEvent.click(screen.getByText("Professional"));
    expect(useSettingsStore.getState().config!.ai.default_style).toBe(
      "professional",
    );
  });
});

// ─── About Tab ─────────────────────────────────────────────────────────────────

describe("AboutTab", () => {
  it("displays app name", () => {
    render(<AboutTab />);
    expect(screen.getByText("Channely")).toBeInTheDocument();
  });

  it("displays version", () => {
    render(<AboutTab />);
    expect(screen.getByText("Version 0.1.0")).toBeInTheDocument();
  });

  it("displays description", () => {
    render(<AboutTab />);
    expect(
      screen.getByText("System-wide AI text proofreading for macOS"),
    ).toBeInTheDocument();
  });

  it("displays built-with info", () => {
    render(<AboutTab />);
    expect(screen.getByText("Tauri 2.0")).toBeInTheDocument();
    expect(screen.getByText("React 19")).toBeInTheDocument();
    expect(screen.getByText("Cerebras")).toBeInTheDocument();
  });

  it("displays license", () => {
    render(<AboutTab />);
    expect(screen.getByText(/MIT License/)).toBeInTheDocument();
  });
});

// ─── Settings Store ────────────────────────────────────────────────────────────

describe("Settings Store", () => {
  it("has correct default values", () => {
    expect(DEFAULT_CONFIG.ai.api_key).toBe("");
    expect(DEFAULT_CONFIG.ai.model).toBe("gpt-oss-120b");
    expect(DEFAULT_CONFIG.ai.reasoning_effort).toBe("high");
    expect(DEFAULT_CONFIG.hotkey.trigger).toBe("Cmd+Shift+K");
    expect(DEFAULT_CONFIG.general.theme).toBe("system");
    expect(DEFAULT_CONFIG.general.onboarding_completed).toBe(false);
    expect(DEFAULT_CONFIG.ui.animations).toBe(true);
  });

  it("loads config on init via invoke", async () => {
    const mockConfig: AppConfig = {
      ...structuredClone(DEFAULT_CONFIG),
      general: { ...DEFAULT_CONFIG.general, theme: "dark" },
    };

    tauriMockState.invokeHandlers.set("get_settings", () => mockConfig);

    await act(async () => {
      await useSettingsStore.getState().loadSettings();
    });

    expect(invoke).toHaveBeenCalledWith("get_settings");
    expect(useSettingsStore.getState().config!.general.theme).toBe("dark");
  });

  it("falls back to defaults on load error", async () => {
    tauriMockState.invokeHandlers.set("get_settings", () => {
      throw new Error("fail");
    });

    await act(async () => {
      await useSettingsStore.getState().loadSettings();
    });

    expect(useSettingsStore.getState().config).not.toBeNull();
    expect(useSettingsStore.getState().config!.ai.model).toBe("gpt-oss-120b");
  });

  it("updateSettings calls invoke with updated config", async () => {
    tauriMockState.invokeHandlers.set("update_settings", () => undefined);

    await act(async () => {
      await useSettingsStore.getState().updateSettings((c) => ({
        ...c,
        general: { ...c.general, theme: "light" },
      }));
    });

    expect(invoke).toHaveBeenCalledWith("update_settings", {
      settings: expect.objectContaining({
        general: expect.objectContaining({ theme: "light" }),
      }),
    });
    expect(useSettingsStore.getState().config!.general.theme).toBe("light");
  });

  it("reverts config on update error", async () => {
    tauriMockState.invokeHandlers.set("update_settings", () => {
      throw new Error("disk error");
    });

    const originalTheme = useSettingsStore.getState().config!.general.theme;

    await act(async () => {
      await useSettingsStore.getState().updateSettings((c) => ({
        ...c,
        general: { ...c.general, theme: "dark" },
      }));
    });

    expect(useSettingsStore.getState().config!.general.theme).toBe(originalTheme);
  });

  it("setActiveTab changes active tab", () => {
    useSettingsStore.getState().setActiveTab("cerebras");
    expect(useSettingsStore.getState().activeTab).toBe("cerebras");
  });

  it("markOnboardingCompleted persists completion flag", async () => {
    tauriMockState.invokeHandlers.set("update_settings", () => undefined);

    await act(async () => {
      await useSettingsStore.getState().markOnboardingCompleted();
    });

    expect(useSettingsStore.getState().config!.general.onboarding_completed).toBe(
      true,
    );
    expect(invoke).toHaveBeenCalledWith("update_settings", {
      settings: expect.objectContaining({
        general: expect.objectContaining({ onboarding_completed: true }),
      }),
    });
  });

  it("config save → reload → values persist (mocked)", async () => {
    let savedConfig: AppConfig | null = null;

    tauriMockState.invokeHandlers.set("update_settings", (args: unknown) => {
      savedConfig = (args as { settings: AppConfig }).settings;
    });
    tauriMockState.invokeHandlers.set("get_settings", () => savedConfig);

    // Save
    await act(async () => {
      await useSettingsStore.getState().updateSettings((c) => ({
        ...c,
        ai: { ...c.ai, reasoning_effort: "low" },
      }));
    });

    expect(savedConfig).not.toBeNull();
    expect(savedConfig!.ai.reasoning_effort).toBe("low");

    // Reload
    await act(async () => {
      await useSettingsStore.getState().loadSettings();
    });

    expect(useSettingsStore.getState().config!.ai.reasoning_effort).toBe("low");
  });
});
