// Channely — System-wide AI text proofreading for macOS

pub mod ai;
pub mod clipboard;
pub mod commands;
pub mod config;
pub mod diff;
pub mod hotkey;
pub mod keystroke;
pub mod performance;
pub mod permissions;
pub mod tray;

use std::sync::Mutex;

use commands::{
    ai::{proofread_text, test_connection},
    clipboard::{accept_overlay_text, get_selected_text, replace_text, PreservedClipboard},
    diff::compute_diff,
    hotkey::set_overlay_shortcuts_enabled,
    performance::{get_memory_profile, get_startup_performance},
    settings::{
        get_accessibility_permission_status, get_focus_mode_status, get_settings,
        open_accessibility_settings, open_settings, update_settings,
    },
};
use config::ConfigState;
use log::{info, warn};
use performance::PerformanceState;
use tauri::{Manager, RunEvent, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;

/// IPC command: quit the entire application from the frontend.
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    info!("Quit requested from frontend");
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        // ── Tauri Plugins ──────────────────────────────────────────────
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        // Keep the app running in the tray when the main window receives a close event.
        // This avoids accidental process termination when macOS/webview dispatches close.
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }

            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if let Err(e) = window.hide() {
                    warn!("Failed to hide main window on close request: {e}");
                } else {
                    info!("Main window close intercepted; hidden to tray");
                }
            }
        })
        // ── Setup ──────────────────────────────────────────────────────
        .setup(|app| {
            let startup = std::time::Instant::now();

            // Logging (debug builds only)
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Managed state: performance metrics
            app.manage(PerformanceState::default());

            // Managed state: config (defaults immediately; persisted config loaded after tray)
            app.manage(ConfigState(
                Mutex::new(config::schema::AppConfig::default()),
            ));

            // Managed state: preserved clipboard for round-trip
            app.manage(PreservedClipboard(Mutex::new(None)));

            // System tray
            tray::menu::setup_tray(app)?;
            {
                let perf = app.state::<PerformanceState>();
                performance::record_tray_ready(&perf, startup.elapsed());
            }

            // Load persisted config from disk and replace in-memory defaults.
            let loaded_config = config::load_config(app.handle()).unwrap_or_else(|e| {
                log::warn!("Failed to load config, using defaults: {e}");
                config::schema::AppConfig::default()
            });
            let should_show_onboarding = !loaded_config.general.onboarding_completed;
            if let Ok(mut config_guard) = app.state::<ConfigState>().0.lock() {
                *config_guard = loaded_config;
            }

            // Global hotkey: Cmd+Shift+K → capture selected text
            hotkey::handler::register_hotkey(app.handle())?;
            {
                let perf = app.state::<PerformanceState>();
                performance::record_hotkey_ready(&perf, startup.elapsed());
            }

            // First run: show onboarding in the main window.
            if should_show_onboarding {
                if let Some(main_window) = app.get_webview_window("main") {
                    if let Err(e) = main_window.show() {
                        warn!("Failed to show onboarding window: {e}");
                    }
                    if let Err(e) = main_window.set_focus() {
                        warn!("Failed to focus onboarding window: {e}");
                    }
                }
            }

            let perf_report = {
                let perf = app.state::<PerformanceState>();
                performance::startup_report(&perf)
            };
            info!(
                "Startup metrics: tray_ready_ms={:?}, hotkey_ready_ms={:?}, target_ms={}",
                perf_report.tray_ready_ms,
                perf_report.hotkey_ready_ms,
                perf_report.cold_start_target_ms
            );

            info!("Channely setup complete");
            Ok(())
        })
        // ── IPC Commands ───────────────────────────────────────────────
        .invoke_handler(tauri::generate_handler![
            get_selected_text,
            replace_text,
            accept_overlay_text,
            proofread_text,
            test_connection,
            get_settings,
            update_settings,
            get_accessibility_permission_status,
            open_accessibility_settings,
            get_focus_mode_status,
            open_settings,
            compute_diff,
            set_overlay_shortcuts_enabled,
            get_startup_performance,
            get_memory_profile,
            quit_app,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            // Prevent the app from exiting when the last visible window (e.g. Settings)
            // is closed. The app should keep running in the tray. Explicit quit goes
            // through `app.exit(0)` which bypasses this handler.
            if let RunEvent::ExitRequested { api, .. } = event {
                api.prevent_exit();
            }
        });
}

#[cfg(test)]
mod tests {
    #[test]
    fn app_initializes() {
        // Placeholder test — verifies the test harness works
        assert_eq!(2 + 2, 4);
    }
}
