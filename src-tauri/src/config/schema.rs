// Configuration schema
// Stored at ~/Library/Application Support/com.channely.app/config.toml

use serde::{Deserialize, Serialize};

/// Root application configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct AppConfig {
    pub general: GeneralConfig,
    pub hotkey: HotkeyConfig,
    pub ai: AIConfig,
    pub ui: UIConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct GeneralConfig {
    pub launch_at_login: bool,
    pub theme: String, // "light" | "dark" | "system"
    pub show_menubar_icon: bool,
    pub onboarding_completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct HotkeyConfig {
    pub trigger: String,
    pub accept: String,
    pub dismiss: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AIConfig {
    pub api_key: String,
    pub model: String,
    pub reasoning_effort: String, // "low" | "medium" | "high"
    pub max_completion_tokens: u32,
    pub timeout_seconds: u64,
    pub default_style: String, // "casual" | "professional" | "concise" | "friendly"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct UIConfig {
    pub overlay_position: String, // "cursor" | "center" | "top-right"
    pub show_diff: bool,
    pub auto_dismiss_seconds: u64,
    pub animations: bool,
}

impl Default for GeneralConfig {
    fn default() -> Self {
        Self {
            launch_at_login: true,
            theme: "system".to_string(),
            show_menubar_icon: true,
            onboarding_completed: false,
        }
    }
}

impl Default for HotkeyConfig {
    fn default() -> Self {
        Self {
            trigger: "Cmd+Shift+K".to_string(),
            accept: "Tab".to_string(),
            dismiss: "Escape".to_string(),
        }
    }
}

impl Default for AIConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            model: "gpt-oss-120b".to_string(),
            reasoning_effort: "high".to_string(),
            max_completion_tokens: 32768,
            timeout_seconds: 30,
            default_style: "casual".to_string(),
        }
    }
}

impl Default for UIConfig {
    fn default() -> Self {
        Self {
            overlay_position: "cursor".to_string(),
            show_diff: true,
            auto_dismiss_seconds: 0,
            animations: true,
        }
    }
}
