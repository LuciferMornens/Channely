pub mod schema;

use schema::AppConfig;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

/// Managed state wrapping the in-memory config
pub struct ConfigState(pub Mutex<AppConfig>);

/// Get the config file path: <app_data_dir>/config.json
pub fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?;
    Ok(dir.join("config.json"))
}

/// Load config from disk, or create default if missing
pub fn load_config(app: &tauri::AppHandle) -> Result<AppConfig, String> {
    let path = config_path(app)?;

    if path.exists() {
        let content =
            fs::read_to_string(&path).map_err(|e| format!("Failed to read config: {e}"))?;
        let config: AppConfig =
            serde_json::from_str(&content).map_err(|e| format!("Failed to parse config: {e}"))?;
        Ok(config)
    } else {
        let config = AppConfig::default();
        save_config(app, &config)?;
        Ok(config)
    }
}

/// Save config to disk as JSON
pub fn save_config(app: &tauri::AppHandle, config: &AppConfig) -> Result<(), String> {
    let path = config_path(app)?;

    // Ensure parent dir exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create config dir: {e}"))?;
    }

    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {e}"))?;
    fs::write(&path, json).map_err(|e| format!("Failed to write config: {e}"))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_serializes_to_json() {
        let config = AppConfig::default();
        let json = serde_json::to_string_pretty(&config).unwrap();
        assert!(json.contains("gpt-oss-120b"));
        assert!(json.contains("Cmd+Shift+K"));
        assert!(json.contains("casual"));
    }

    #[test]
    fn config_round_trip() {
        let config = AppConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        let restored: AppConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.ai.api_key, "");
        assert_eq!(restored.ai.model, "gpt-oss-120b");
        assert_eq!(restored.hotkey.trigger, "Cmd+Shift+K");
        assert_eq!(restored.general.theme, "system");
        assert_eq!(restored.ui.overlay_position, "cursor");
    }

    #[test]
    fn config_partial_update() {
        let mut config = AppConfig::default();
        config.ai.reasoning_effort = "low".to_string();
        config.general.theme = "dark".to_string();
        let json = serde_json::to_string(&config).unwrap();
        let restored: AppConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.ai.reasoning_effort, "low");
        assert_eq!(restored.general.theme, "dark");
    }

    #[test]
    fn legacy_config_without_onboarding_flag_uses_default() {
        let json = r#"{
            "general": {
                "launch_at_login": true,
                "theme": "system",
                "show_menubar_icon": true
            },
            "hotkey": {
                "trigger": "Cmd+Shift+K",
                "accept": "Tab",
                "dismiss": "Escape"
            },
            "ai": {
                "model": "gpt-oss-120b",
                "reasoning_effort": "high",
                "max_completion_tokens": 32768,
                "timeout_seconds": 30,
                "default_style": "casual"
            },
            "ui": {
                "overlay_position": "cursor",
                "show_diff": true,
                "auto_dismiss_seconds": 0,
                "animations": true
            }
        }"#;

        let restored: AppConfig = serde_json::from_str(json).unwrap();
        assert!(!restored.general.onboarding_completed);
        assert_eq!(restored.ai.api_key, "");
    }
}
