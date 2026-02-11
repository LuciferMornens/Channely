// Tauri IPC commands for settings/config management

use tauri::command;
use tauri::{AppHandle, Emitter, Manager};

use crate::config::schema::AppConfig;
use crate::config::{self, ConfigState};
use crate::permissions;

/// Get current application settings
#[command]
pub fn get_settings(app: AppHandle) -> Result<AppConfig, String> {
    let state = app.state::<ConfigState>();
    let config = state
        .0
        .lock()
        .map_err(|e| format!("Failed to lock config: {e}"))?;
    Ok(config.clone())
}

/// Update application settings (full replacement)
#[command]
pub fn update_settings(app: AppHandle, settings: AppConfig) -> Result<(), String> {
    // Update in-memory state
    {
        let state = app.state::<ConfigState>();
        let mut config = state
            .0
            .lock()
            .map_err(|e| format!("Failed to lock config: {e}"))?;
        *config = settings.clone();
    }

    // Persist to disk
    config::save_config(&app, &settings)?;

    // Emit settings-changed event so all windows can react
    app.emit("settings-changed", &settings)
        .map_err(|e| format!("Failed to emit event: {e}"))?;

    Ok(())
}

/// Return `true` when the process has Accessibility permission on macOS.
#[command]
pub fn get_accessibility_permission_status() -> bool {
    permissions::is_accessibility_permission_granted()
}

#[command]
pub fn get_focus_mode_status() -> permissions::FocusModeStatus {
    permissions::focus_mode_status()
}

/// Open macOS System Settings to the Accessibility privacy panel.
#[command]
pub fn open_accessibility_settings() -> Result<(), String> {
    permissions::open_accessibility_settings()
}

/// Open the settings window (create or focus existing)
#[command]
pub async fn open_settings(app: AppHandle) -> Result<(), String> {
    use tauri::WebviewWindowBuilder;

    // If settings window already exists, focus it
    if let Some(win) = app.get_webview_window("settings") {
        win.show()
            .map_err(|e| format!("Failed to show settings: {e}"))?;
        win.set_focus()
            .map_err(|e| format!("Failed to focus settings: {e}"))?;
        return Ok(());
    }

    // Create new settings window
    let _win = WebviewWindowBuilder::new(&app, "settings", tauri::WebviewUrl::App("/".into()))
        .title("Channely Settings")
        .inner_size(640.0, 480.0)
        .min_inner_size(540.0, 400.0)
        .resizable(true)
        .decorations(true)
        .always_on_top(false)
        .visible(true)
        .center()
        .build()
        .map_err(|e| format!("Failed to create settings window: {e}"))?;

    Ok(())
}
