// Clipboard manager — read, write, preserve, and restore clipboard contents.
// Uses tauri-plugin-clipboard-manager via ClipboardExt.

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime};
use tauri_plugin_clipboard_manager::ClipboardExt;

/// Preserved clipboard state for restoration after proofreading.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardState {
    /// The text that was on the clipboard before we touched it.
    /// `None` means the clipboard was empty or contained non-text data.
    pub text: Option<String>,
}

/// Read the current clipboard text.
/// Returns an error only on real clipboard failures;
/// an empty clipboard or non-text content returns `Ok(String)` / graceful error.
pub fn read_text<R: Runtime>(app_handle: &AppHandle<R>) -> Result<String, String> {
    app_handle
        .clipboard()
        .read_text()
        .map_err(|e| format!("Clipboard read failed: {e}"))
}

/// Write text to the clipboard.
pub fn write_text<R: Runtime>(app_handle: &AppHandle<R>, text: &str) -> Result<(), String> {
    app_handle
        .clipboard()
        .write_text(text)
        .map_err(|e| format!("Clipboard write failed: {e}"))
}

/// Save the current clipboard contents so they can be restored later.
/// Non-text content is silently ignored (state.text will be `None`).
pub fn preserve<R: Runtime>(app_handle: &AppHandle<R>) -> ClipboardState {
    let text = app_handle.clipboard().read_text().ok();
    ClipboardState { text }
}

/// Restore previously saved clipboard contents.
/// If the saved state was non-text (`None`), we skip restoration silently.
pub fn restore<R: Runtime>(
    app_handle: &AppHandle<R>,
    state: &ClipboardState,
) -> Result<(), String> {
    if let Some(ref text) = state.text {
        write_text(app_handle, text)?;
    }
    // If state.text is None the clipboard had non-text content;
    // we can't restore that, so we do nothing (don't crash).
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clipboard_state_default_is_none() {
        let state = ClipboardState { text: None };
        assert!(state.text.is_none());
    }

    #[test]
    fn clipboard_state_serialization_roundtrip() {
        let state = ClipboardState {
            text: Some("hello world".to_string()),
        };
        let json = serde_json::to_string(&state).unwrap();
        let deserialized: ClipboardState = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.text.as_deref(), Some("hello world"));
    }

    #[test]
    fn clipboard_state_none_serialization_roundtrip() {
        let state = ClipboardState { text: None };
        let json = serde_json::to_string(&state).unwrap();
        let deserialized: ClipboardState = serde_json::from_str(&json).unwrap();
        assert!(deserialized.text.is_none());
    }
}
