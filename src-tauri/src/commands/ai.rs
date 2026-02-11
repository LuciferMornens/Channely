// Tauri IPC commands for Cerebras AI operations

use tauri::command;
use tauri::Emitter;
use tauri::Manager;

use crate::ai::cerebras;
use crate::ai::runtime_config;
use crate::ai::text_guard;
use crate::ai::types::Style;
use crate::hotkey::handler::EVENT_CAPTURE_WARNING;

/// Stream text to Cerebras for proofreading, emitting tokens via Tauri events.
///
/// The corrected text is streamed to the frontend via `cerebras:delta` events,
/// and the full corrected text is also returned as the command result.
#[command]
pub async fn proofread_text(
    window: tauri::Window,
    text: String,
    style: Option<String>,
) -> Result<String, String> {
    let config =
        runtime_config::config_from_state_or_env(window.app_handle()).map_err(|e| e.to_string())?;
    let style = Style::from_str_lenient(style.as_deref().unwrap_or("casual"));
    let prepared = text_guard::prepare_input_text(&text);

    if let Some(ref warning) = prepared.warning {
        let _ = window.emit(EVENT_CAPTURE_WARNING, warning.to_user_message());
    }

    cerebras::stream_proofread(&window, &prepared.text, &style, &config)
        .await
        .map_err(|e| e.to_string())
}

/// Test connection to Cerebras API — validates the API key with a lightweight call.
///
/// Returns `true` on success, or a descriptive error on failure.
#[command]
pub async fn test_connection(app: tauri::AppHandle) -> Result<bool, String> {
    let config = runtime_config::config_from_state_or_env(&app).map_err(|e| e.to_string())?;

    cerebras::test_api_connection(&config)
        .await
        .map_err(|e| e.to_string())
}
