// Tauri IPC commands for clipboard operations.
//
// - `get_selected_text`: Preserve clipboard → Cmd+C → read → return text.
// - `replace_text`: Write corrected text → Cmd+V → restore original clipboard.
// - `accept_overlay_text`: Disable overlay shortcuts → hide overlay window
//   → paste corrected text → restore original clipboard.

use std::sync::Mutex;

use log::info;
use tauri::{command, AppHandle, Manager, Runtime};

use crate::clipboard::manager::{self as clipboard, ClipboardState};
use crate::keystroke;

const PRE_PASTE_FOCUS_DELAY_MS: u64 = 90;
const POST_PASTE_SETTLE_DELAY_MS: u64 = 100;
const OVERLAY_HIDE_FOCUS_DELAY_MS: u64 = 90;

/// Managed state that holds the preserved clipboard contents between
/// `get_selected_text` and `replace_text` calls.
pub struct PreservedClipboard(pub Mutex<Option<ClipboardState>>);

/// Get the currently selected text from the active application.
///
/// Flow:
/// 1. Preserve clipboard
/// 2. Simulate Cmd+C
/// 3. Wait 100ms
/// 4. Read clipboard (now contains selected text)
/// 5. Return the text
///
/// The preserved clipboard state is kept in managed state so it can be
/// restored later via `replace_text`.
#[command]
pub async fn get_selected_text<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    // 1. Preserve clipboard
    let saved = clipboard::preserve(&app);
    info!("Clipboard preserved (had text: {})", saved.text.is_some());

    // Store for later restoration
    {
        let state = app.state::<PreservedClipboard>();
        let mut guard = state.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        *guard = Some(saved);
    }

    // 2. Simulate Cmd+C
    keystroke::simulate_copy().map_err(|e| format!("Simulate Cmd+C failed: {e}"))?;

    // 3. Wait for the system to process the copy
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;

    // 4. Read clipboard
    let text = clipboard::read_text(&app)?;

    // 5. Edge case: empty selection
    if text.trim().is_empty() {
        // Restore clipboard immediately since there's nothing to process
        let state = app.state::<PreservedClipboard>();
        let guard = state.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        if let Some(ref saved) = *guard {
            let _ = clipboard::restore(&app, saved);
        }
        return Err("No text selected — selection was empty".to_string());
    }

    info!("Captured selected text: {} chars", text.len());
    Ok(text)
}

/// Replace the currently selected text with corrected text.
///
/// Flow:
/// 1. Write corrected text to clipboard
/// 2. Wait briefly so focus can return to the source app
/// 3. Simulate Cmd+V (paste)
/// 4. Wait 100ms
/// 5. Restore original clipboard contents
#[command]
pub async fn replace_text<R: Runtime>(app: AppHandle<R>, text: String) -> Result<(), String> {
    replace_text_internal(&app, &text).await
}

/// Accept overlay result and replace in the previously focused app.
///
/// Flow:
/// 1. Disable temporary overlay shortcuts
/// 2. Hide overlay window
/// 3. Wait briefly so source app regains focus
/// 4. Write corrected text to clipboard
/// 5. Simulate Cmd+V
/// 6. Restore original clipboard contents
#[command]
pub async fn accept_overlay_text<R: Runtime>(
    app: AppHandle<R>,
    text: String,
) -> Result<(), String> {
    crate::hotkey::handler::unregister_overlay_shortcuts(&app)?;
    hide_overlay_window(&app)?;

    tokio::time::sleep(std::time::Duration::from_millis(
        OVERLAY_HIDE_FOCUS_DELAY_MS,
    ))
    .await;

    // Re-activate the app that was focused when the user pressed Cmd+Shift+K.
    // After hiding our always-on-top overlay, macOS may not automatically
    // return focus to the previous app, so we do it explicitly.
    crate::hotkey::handler::reactivate_source_app();

    // Brief extra settle for the source app to become ready for input.
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;

    replace_text_internal(&app, &text).await
}

async fn replace_text_internal<R: Runtime>(app: &AppHandle<R>, text: &str) -> Result<(), String> {
    // 1. Write corrected text to clipboard
    clipboard::write_text(app, text)?;
    info!("Wrote corrected text to clipboard: {} chars", text.len());

    // 2. Allow frontend window hide/focus handoff to settle.
    tokio::time::sleep(std::time::Duration::from_millis(PRE_PASTE_FOCUS_DELAY_MS)).await;

    // 3. Simulate Cmd+V
    keystroke::simulate_paste().map_err(|e| format!("Simulate Cmd+V failed: {e}"))?;

    // 4. Wait for the system to process the paste
    tokio::time::sleep(std::time::Duration::from_millis(POST_PASTE_SETTLE_DELAY_MS)).await;

    // 5. Restore original clipboard
    if let Some(saved) = take_preserved_clipboard(app)? {
        clipboard::restore(app, &saved)?;
        info!("Original clipboard restored");
    }

    Ok(())
}

fn hide_overlay_window<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    window
        .hide()
        .map_err(|e| format!("Failed to hide overlay window: {e}"))
}

fn take_preserved_clipboard<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Option<ClipboardState>, String> {
    let state = app.state::<PreservedClipboard>();
    let mut guard = state.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    Ok(guard.take())
}
