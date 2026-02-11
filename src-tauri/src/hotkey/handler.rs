// Global hotkey handler — registers Cmd+Shift+K and wires the full
// "capture selected text" flow.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use log::info;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Minimum cooldown between invocations to prevent "double-tap" scenarios.
pub const COOLDOWN_DURATION: Duration = Duration::from_millis(300);
const CLIPBOARD_READ_RETRY_INTERVAL: Duration = Duration::from_millis(50);
const CLIPBOARD_READ_MAX_ATTEMPTS: usize = 5;
const PRE_COPY_SETTLE_DELAY: Duration = Duration::from_millis(60);
const CLIPBOARD_PROBE_PREFIX: &str = "__CHANNELY_CAPTURE_PROBE__";
static CLIPBOARD_PROBE_COUNTER: AtomicU64 = AtomicU64::new(0);
/// Explicit flag: true while the overlay is visible and its shortcuts are active.
static OVERLAY_ACTIVE: AtomicBool = AtomicBool::new(false);

/// Stores the PID of the app that was frontmost when the hotkey was pressed,
/// so we can re-activate it after the overlay is dismissed/accepted.
static SOURCE_APP_PID: AtomicU64 = AtomicU64::new(0);

use crate::ai::cerebras;
use crate::ai::runtime_config;
use crate::ai::text_guard;
use crate::ai::types::Style;
use crate::clipboard::manager as clipboard;
use crate::keystroke;
use crate::tray::{menu as tray_menu, state as tray_state};

/// Event name emitted to the frontend when selected text is captured.
pub const EVENT_TEXT_CAPTURED: &str = "channely://text-captured";

/// Event name emitted when an error occurs during capture.
pub const EVENT_CAPTURE_ERROR: &str = "channely://capture-error";

/// Event name emitted when captured input is truncated for safety/perf.
pub const EVENT_CAPTURE_WARNING: &str = "channely://capture-warning";
/// Event name emitted when overlay accept is requested via global shortcut.
pub const EVENT_OVERLAY_ACCEPT: &str = "channely://overlay-accept";
/// Event name emitted when overlay dismiss is requested via global shortcut.
pub const EVENT_OVERLAY_DISMISS: &str = "channely://overlay-dismiss";
const OVERLAY_SHORTCUTS: [&str; 3] = ["Enter", "Tab", "Escape"];

/// Register the global hotkey (Cmd+Shift+K) and wire the full capture flow.
///
/// The flow on each press:
/// 1. Check if Channely is paused — if so, skip entirely.
/// 2. Guard against concurrent invocations (debounce via AtomicBool).
/// 3. Preserve current clipboard.
/// 4. Simulate Cmd+C to copy selected text.
/// 5. Wait briefly for the system to process.
/// 6. Read clipboard (now contains selected text).
/// 7. Emit event to frontend with the captured text.
/// 8. (Clipboard restoration happens later, after the AI round-trip.)
pub fn register_hotkey<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let busy = Arc::new(AtomicBool::new(false));
    // Track last invocation time for cooldown enforcement.
    // Initialised to a point far enough in the past that the first press always works.
    let last_invocation = Arc::new(Mutex::new(Instant::now() - COOLDOWN_DURATION));

    app.global_shortcut()
        .on_shortcut("CmdOrCtrl+Shift+K", {
            let busy = busy.clone();
            let last_invocation = last_invocation.clone();
            move |app_handle, _shortcut, event| {
                // Only trigger capture on key-up (Release), not Press.
                // This avoids modifier-bleed where Shift may still be held
                // while simulating Cmd+C in target apps.
                if !should_capture_for_state(event.state) {
                    return;
                }

                // If Channely is paused, ignore the hotkey entirely.
                if tray_state::is_paused() {
                    info!("Hotkey pressed while paused — ignoring");
                    return;
                }

                // Ignore the hotkey while onboarding is active. During
                // onboarding the main window is interactive and the hotkey
                // capture flow can interfere with UX.
                if !is_onboarding_completed(app_handle) {
                    info!("Hotkey pressed during onboarding — ignoring");
                    return;
                }

                // Ignore the hotkey while the overlay is already visible.
                if OVERLAY_ACTIVE.load(Ordering::SeqCst) {
                    info!("Hotkey pressed while overlay is visible — ignoring");
                    return;
                }

                // Cooldown: reject presses that arrive within COOLDOWN_DURATION
                // of the last invocation to prevent "double-tap" scenarios.
                {
                    let last = last_invocation.lock().unwrap_or_else(|e| e.into_inner());
                    if last.elapsed() < COOLDOWN_DURATION {
                        info!("Hotkey pressed during cooldown — skipping");
                        return;
                    }
                }

                // Debounce: skip if we're already processing a capture.
                if busy.swap(true, Ordering::SeqCst) {
                    info!("Hotkey pressed while already processing — skipping");
                    return;
                }

                // Record this invocation time for cooldown enforcement.
                {
                    let mut last = last_invocation.lock().unwrap_or_else(|e| e.into_inner());
                    *last = Instant::now();
                }

                let app_handle = app_handle.clone();
                let busy = busy.clone();

                // Record which app was frontmost BEFORE we do anything.
                // This is the app we need to re-activate after the overlay
                // is accepted/dismissed so Cmd+V pastes into the right place.
                let source_pid = get_frontmost_app_pid();
                if source_pid > 0 {
                    SOURCE_APP_PID.store(source_pid, Ordering::SeqCst);
                }

                // Spawn the capture work onto a background thread so we don't
                // block the hotkey event handler.
                tauri::async_runtime::spawn(async move {
                    let result = capture_selected_text(&app_handle).await;
                    match result {
                        Ok(text) => {
                            let prepared = text_guard::prepare_input_text(&text);
                            info!(
                                "Captured selected text ({} chars, sending {} chars)",
                                text.chars().count(),
                                prepared.text.chars().count()
                            );
                            if let Some(ref warning) = prepared.warning {
                                let _ = app_handle
                                    .emit(EVENT_CAPTURE_WARNING, warning.to_user_message());
                            }
                            let _ = app_handle.emit(EVENT_TEXT_CAPTURED, &prepared.text);

                            // Trigger Cerebras proofreading stream (Phase 2)
                            match runtime_config::config_from_state_or_env(&app_handle) {
                                Ok(config) => {
                                    let style = Style::Casual; // default style
                                    match cerebras::stream_proofread(
                                        &app_handle,
                                        &prepared.text,
                                        &style,
                                        &config,
                                    )
                                    .await
                                    {
                                        Ok(corrected) => {
                                            info!(
                                                "Cerebras proofreading complete ({} chars)",
                                                corrected.len()
                                            );
                                            // Increment the improvement counter
                                            let count = tray_state::increment_improvements();
                                            info!("Texts improved this session: {count}");
                                            // Update the tray menu counter display
                                            tray_menu::update_counter(&app_handle);
                                        }
                                        Err(e) => {
                                            info!("Cerebras error: {e}");
                                            let _ = app_handle
                                                .emit(EVENT_CAPTURE_ERROR, &e.to_string());
                                        }
                                    }
                                }
                                Err(e) => {
                                    info!("Cerebras config error: {e}");
                                    let _ = app_handle.emit(EVENT_CAPTURE_ERROR, &e.to_string());
                                }
                            }
                        }
                        Err(e) => {
                            info!("Capture error: {e}");
                            let _ = app_handle.emit(EVENT_CAPTURE_ERROR, &e);
                        }
                    }
                    busy.store(false, Ordering::SeqCst);
                });
            }
        })
        .map_err(|e| format!("Failed to register hotkey: {e}"))?;

    info!("Global hotkey Cmd+Shift+K registered");
    Ok(())
}

fn is_onboarding_completed<R: Runtime>(app_handle: &AppHandle<R>) -> bool {
    if let Some(state) = app_handle.try_state::<crate::config::ConfigState>() {
        if let Ok(config) = state.0.lock() {
            return config.general.onboarding_completed;
        }
    }

    // Fail-open so existing behavior remains functional if state
    // cannot be read for any reason.
    true
}

/// Unregister all global hotkeys.
pub fn unregister_all<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    app.global_shortcut()
        .unregister_all()
        .map_err(|e| format!("Failed to unregister hotkeys: {e}"))
}

/// Register temporary global shortcuts while overlay is visible.
///
/// These are intentionally no-modifier keys so accept/dismiss works even when
/// the overlay webview does not have keyboard focus.
pub fn register_overlay_shortcuts<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    if overlay_shortcuts_enabled(app) {
        return Ok(());
    }

    unregister_overlay_shortcuts(app)?;

    app.global_shortcut()
        .on_shortcuts(OVERLAY_SHORTCUTS, move |app_handle, shortcut, event| {
            if !should_capture_for_state(event.state) {
                return;
            }

            if let Some((event_name, payload)) = overlay_event_for_shortcut(shortcut) {
                let _ = app_handle.emit(event_name, payload);
            }
        })
        .map_err(|e| format!("Failed to register overlay shortcuts: {e}"))?;

    OVERLAY_ACTIVE.store(true, Ordering::SeqCst);
    Ok(())
}

/// Unregister only the temporary overlay shortcuts.
pub fn unregister_overlay_shortcuts<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    OVERLAY_ACTIVE.store(false, Ordering::SeqCst);

    let registered = registered_overlay_shortcuts(app);
    if registered.is_empty() {
        return Ok(());
    }

    app.global_shortcut()
        .unregister_multiple(registered)
        .map_err(|e| format!("Failed to unregister overlay shortcuts: {e}"))
}

/// Perform the full "capture selected text" flow.
///
/// 1. Preserve clipboard
/// 2. Simulate Cmd+C
/// 3. Wait briefly for modifiers/focus to settle
/// 4. Read clipboard with short retries
/// 5. Return captured text (or error if empty)
///
/// NOTE: The preserved clipboard state is stored in Tauri managed state
/// (via the commands module) so it can be restored after the AI round-trip.
async fn capture_selected_text<R: Runtime>(app_handle: &AppHandle<R>) -> Result<String, String> {
    // 1. Preserve current clipboard
    let saved = clipboard::preserve(app_handle);
    let saved_for_restore = saved.clone();

    // Store the preserved state for later restoration.
    // We use Tauri managed state (see commands/clipboard.rs).
    {
        let state = app_handle.try_state::<crate::commands::clipboard::PreservedClipboard>();
        if let Some(state) = state {
            let mut guard = state.0.lock().map_err(|e| format!("Lock error: {e}"))?;
            *guard = Some(saved);
        }
    }

    // Write a per-capture probe marker so we can reliably distinguish
    // "copy hasn't updated the clipboard yet" from a valid same-text recapture.
    let probe_marker = create_clipboard_probe_marker();
    if let Err(e) = clipboard::write_text(app_handle, &probe_marker) {
        restore_clipboard_after_failed_capture(app_handle, &saved_for_restore);
        return Err(format!("Clipboard probe write failed: {e}"));
    }

    // 2-3. Wait briefly before copying so lingering shortcut modifiers
    // (notably Shift in Cmd+Shift+K) don't bleed into synthetic Cmd+C.
    tokio::time::sleep(PRE_COPY_SETTLE_DELAY).await;

    // 3. Simulate Cmd+C
    if let Err(e) = keystroke::simulate_copy() {
        restore_clipboard_after_failed_capture(app_handle, &saved_for_restore);
        return Err(format!("Simulate Cmd+C failed: {e}"));
    }

    // 4. Read clipboard with short retries.
    for attempt in 0..CLIPBOARD_READ_MAX_ATTEMPTS {
        let text = match clipboard::read_text(app_handle) {
            Ok(text) => text,
            Err(e) => {
                restore_clipboard_after_failed_capture(app_handle, &saved_for_restore);
                return Err(e);
            }
        };

        if should_retry_clipboard_read(&text, &probe_marker) {
            if attempt + 1 < CLIPBOARD_READ_MAX_ATTEMPTS {
                tokio::time::sleep(CLIPBOARD_READ_RETRY_INTERVAL).await;
                continue;
            }
            restore_clipboard_after_failed_capture(app_handle, &saved_for_restore);
            if text.trim().is_empty() {
                return Err("Empty selection — no text was copied".to_string());
            }
            return Err("No selected text captured — copy did not update clipboard".to_string());
        }

        return Ok(text);
    }

    restore_clipboard_after_failed_capture(app_handle, &saved_for_restore);
    Err("No selected text captured — copy did not update clipboard".to_string())
}

/// Check whether a new invocation should be allowed given the last invocation
/// time and the standard cooldown. Returns `true` if the cooldown has elapsed.
///
/// This is extracted as a pure function so it can be tested without a Tauri
/// runtime.
pub fn cooldown_elapsed(last_invocation: Instant) -> bool {
    last_invocation.elapsed() >= COOLDOWN_DURATION
}

pub fn should_capture_for_state(state: ShortcutState) -> bool {
    state == ShortcutState::Pressed
}

fn overlay_shortcuts_enabled<R: Runtime>(app: &AppHandle<R>) -> bool {
    OVERLAY_SHORTCUTS
        .iter()
        .all(|shortcut| app.global_shortcut().is_registered(*shortcut))
}

fn registered_overlay_shortcuts<R: Runtime>(app: &AppHandle<R>) -> Vec<&'static str> {
    OVERLAY_SHORTCUTS
        .iter()
        .copied()
        .filter(|shortcut| app.global_shortcut().is_registered(*shortcut))
        .collect()
}

fn overlay_event_for_shortcut(shortcut: &Shortcut) -> Option<(&'static str, &'static str)> {
    if shortcut.matches(Modifiers::empty(), Code::Enter)
        || shortcut.matches(Modifiers::empty(), Code::NumpadEnter)
    {
        return Some((EVENT_OVERLAY_ACCEPT, "Enter"));
    }
    if shortcut.matches(Modifiers::empty(), Code::Tab) {
        return Some((EVENT_OVERLAY_ACCEPT, "Tab"));
    }
    if shortcut.matches(Modifiers::empty(), Code::Escape) {
        return Some((EVENT_OVERLAY_DISMISS, "Escape"));
    }

    None
}

fn create_clipboard_probe_marker() -> String {
    let counter = CLIPBOARD_PROBE_COUNTER.fetch_add(1, Ordering::Relaxed);
    let timestamp_nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);

    format!("{CLIPBOARD_PROBE_PREFIX}{timestamp_nanos:x}-{counter:x}")
}

fn restore_clipboard_after_failed_capture<R: Runtime>(
    app_handle: &AppHandle<R>,
    saved: &clipboard::ClipboardState,
) {
    if let Err(e) = clipboard::restore(app_handle, saved) {
        info!("Failed to restore clipboard after capture failure: {e}");
    }

    if let Some(state) = app_handle.try_state::<crate::commands::clipboard::PreservedClipboard>() {
        match state.0.lock() {
            Ok(mut guard) => {
                *guard = None;
            }
            Err(e) => {
                info!("Failed to clear preserved clipboard after capture failure: {e}");
            }
        }
    }
}

pub fn should_retry_clipboard_read(text: &str, probe_marker: &str) -> bool {
    if text.trim().is_empty() {
        return true;
    }

    text == probe_marker
}

/// Get the PID of the currently frontmost application via osascript.
/// Returns 0 if it cannot be determined.
fn get_frontmost_app_pid() -> u64 {
    let result = std::process::Command::new("osascript")
        .arg("-e")
        .arg("tell application \"System Events\" to get unix id of first application process whose frontmost is true")
        .output();

    match result {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            stdout.trim().parse::<u64>().unwrap_or(0)
        }
        _ => 0,
    }
}

/// Re-activate the app that was frontmost when the hotkey was pressed.
/// Uses the PID stored in SOURCE_APP_PID.
pub fn reactivate_source_app() {
    let pid = SOURCE_APP_PID.load(Ordering::SeqCst);
    if pid == 0 {
        info!("No source app PID stored — skipping reactivation");
        return;
    }

    let script = format!(
        "tell application \"System Events\" to set frontmost of (first application process whose unix id is {pid}) to true"
    );

    let result = std::process::Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output();

    match result {
        Ok(output) if output.status.success() => {
            info!("Re-activated source app (PID {pid})");
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            info!(
                "Source app reactivation failed (PID {pid}): {}",
                stderr.trim()
            );
        }
        Err(e) => {
            info!("Could not run osascript for reactivation: {e}");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::schema::AppConfig;
    use std::str::FromStr;

    #[test]
    fn cooldown_rejects_immediate_reinvocation() {
        let now = Instant::now();
        // Just created — elapsed ≈ 0, should NOT be allowed.
        assert!(!cooldown_elapsed(now));
    }

    #[test]
    fn cooldown_allows_after_duration() {
        // Simulate a timestamp far enough in the past.
        let past = Instant::now() - Duration::from_millis(350);
        assert!(cooldown_elapsed(past));
    }

    #[test]
    fn cooldown_rejects_within_window() {
        // 100ms ago — still within the 300ms window.
        let recent = Instant::now() - Duration::from_millis(100);
        assert!(!cooldown_elapsed(recent));
    }

    #[test]
    fn cooldown_allows_at_exact_boundary() {
        // At exactly 300ms the cooldown should be considered elapsed (>=).
        let boundary = Instant::now() - COOLDOWN_DURATION;
        // elapsed() will be >= COOLDOWN_DURATION because of execution time.
        assert!(cooldown_elapsed(boundary));
    }

    #[test]
    fn busy_flag_prevents_concurrent_invocations() {
        let busy = AtomicBool::new(false);
        // First swap sets to true and returns false (was not busy).
        assert!(!busy.swap(true, Ordering::SeqCst));
        // Second swap returns true (was busy) — should be skipped.
        assert!(busy.swap(true, Ordering::SeqCst));
        // After releasing, next swap succeeds.
        busy.store(false, Ordering::SeqCst);
        assert!(!busy.swap(true, Ordering::SeqCst));
    }

    #[test]
    fn onboarding_default_is_incomplete() {
        let cfg = AppConfig::default();
        assert!(!cfg.general.onboarding_completed);
    }

    #[test]
    fn capture_triggers_only_on_press() {
        assert!(should_capture_for_state(ShortcutState::Pressed));
        assert!(!should_capture_for_state(ShortcutState::Released));
    }

    #[test]
    fn retries_when_clipboard_is_empty() {
        assert!(should_retry_clipboard_read("", "probe"));
    }

    #[test]
    fn retries_when_clipboard_matches_probe_marker() {
        let probe = create_clipboard_probe_marker();
        assert!(should_retry_clipboard_read(&probe, &probe));
    }

    #[test]
    fn repeated_capture_same_text_is_not_treated_as_stale() {
        let probe = create_clipboard_probe_marker();
        let selected_text = "same text";
        assert_ne!(selected_text, probe);
        assert!(!should_retry_clipboard_read(selected_text, &probe));
    }

    #[test]
    fn does_not_retry_when_clipboard_has_new_non_empty_text() {
        assert!(!should_retry_clipboard_read("new text", "probe"));
    }

    #[test]
    fn probe_marker_has_expected_prefix_and_is_unique() {
        let first = create_clipboard_probe_marker();
        let second = create_clipboard_probe_marker();
        assert!(first.starts_with(CLIPBOARD_PROBE_PREFIX));
        assert!(second.starts_with(CLIPBOARD_PROBE_PREFIX));
        assert_ne!(first, second);
    }

    #[test]
    fn overlay_events_map_for_accept_and_dismiss_keys() {
        let enter = Shortcut::from_str("Enter").expect("Enter shortcut parses");
        let tab = Shortcut::from_str("Tab").expect("Tab shortcut parses");
        let escape = Shortcut::from_str("Escape").expect("Escape shortcut parses");

        assert_eq!(
            overlay_event_for_shortcut(&enter),
            Some((EVENT_OVERLAY_ACCEPT, "Enter"))
        );
        assert_eq!(
            overlay_event_for_shortcut(&tab),
            Some((EVENT_OVERLAY_ACCEPT, "Tab"))
        );
        assert_eq!(
            overlay_event_for_shortcut(&escape),
            Some((EVENT_OVERLAY_DISMISS, "Escape"))
        );
    }
}
