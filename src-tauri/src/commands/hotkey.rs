use tauri::{command, AppHandle, Runtime};

use crate::hotkey::handler;

#[command]
pub fn set_overlay_shortcuts_enabled<R: Runtime>(
    app: AppHandle<R>,
    enabled: bool,
) -> Result<(), String> {
    if enabled {
        handler::register_overlay_shortcuts(&app)
    } else {
        handler::unregister_overlay_shortcuts(&app)
    }
}
