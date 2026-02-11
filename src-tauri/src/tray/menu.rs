// System tray menu implementation
// Creates and manages the macOS menubar tray icon and dropdown menu
//
// Menu layout:
//   ✓ Channely Active       (or "⏸ Channely Paused")
//   ──────────────
//   Style: Casual ▸         (submenu: Casual / Professional / Concise / Friendly)
//   ──────────────
//   Texts improved: 0       (disabled info item, updated dynamically)
//   ──────────────
//   Pause Channely           (or "Resume Channely")
//   Settings...              ⌘,
//   Quit Channely            ⌘Q

use log::info;
use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconBuilder,
    App, Manager, Runtime,
};

use super::state;
use crate::hotkey;

/// Tray icon ID — used to retrieve the tray for tooltip updates.
pub const TRAY_ID: &str = "channely-tray";

/// References to dynamically-updated menu items.
/// Stored as Tauri managed state so we can update them from anywhere.
pub struct TrayMenuState {
    pub status: MenuItem<tauri::Wry>,
    pub toggle: MenuItem<tauri::Wry>,
    pub counter: MenuItem<tauri::Wry>,
    pub style_submenu: Submenu<tauri::Wry>,
    pub style_casual: CheckMenuItem<tauri::Wry>,
    pub style_professional: CheckMenuItem<tauri::Wry>,
    pub style_concise: CheckMenuItem<tauri::Wry>,
    pub style_friendly: CheckMenuItem<tauri::Wry>,
}

/// Build the full tray menu and attach it to the tray icon.
pub fn setup_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    // ── Status item (disabled — just shows current state) ───────
    let status = MenuItem::with_id(app, "status", "✓ Channely Active", false, None::<&str>)?;

    let sep1 = PredefinedMenuItem::separator(app)?;

    // ── Style submenu (radio-style with CheckMenuItems) ─────────
    let style_casual =
        CheckMenuItem::with_id(app, "style_casual", "Casual", true, true, None::<&str>)?;
    let style_professional = CheckMenuItem::with_id(
        app,
        "style_professional",
        "Professional",
        true,
        false,
        None::<&str>,
    )?;
    let style_concise =
        CheckMenuItem::with_id(app, "style_concise", "Concise", true, false, None::<&str>)?;
    let style_friendly =
        CheckMenuItem::with_id(app, "style_friendly", "Friendly", true, false, None::<&str>)?;

    let style_submenu = Submenu::with_id_and_items(
        app,
        "style_submenu",
        "Style: Casual",
        true,
        &[
            &style_casual,
            &style_professional,
            &style_concise,
            &style_friendly,
        ],
    )?;

    let sep2 = PredefinedMenuItem::separator(app)?;

    // ── Counter (disabled info item) ────────────────────────────
    let counter = MenuItem::with_id(app, "counter", "Texts improved: 0", false, None::<&str>)?;

    let sep3 = PredefinedMenuItem::separator(app)?;

    // ── Toggle pause / resume ───────────────────────────────────
    let toggle = MenuItem::with_id(app, "toggle", "Pause Channely", true, None::<&str>)?;

    // ── Settings + Quit ─────────────────────────────────────────
    let settings = MenuItem::with_id(app, "settings", "Settings...", true, Some("CmdOrCtrl+,"))?;
    let quit = MenuItem::with_id(app, "quit", "Quit Channely", true, Some("CmdOrCtrl+Q"))?;

    // ── Assemble menu ───────────────────────────────────────────
    let menu = Menu::with_items(
        app,
        &[
            &status,
            &sep1,
            &style_submenu,
            &sep2,
            &counter,
            &sep3,
            &toggle,
            &settings,
            &quit,
        ],
    )?;

    // ── Store references for dynamic updates ────────────────────
    app.manage(TrayMenuState {
        status: status.clone(),
        toggle: toggle.clone(),
        counter: counter.clone(),
        style_submenu: style_submenu.clone(),
        style_casual: style_casual.clone(),
        style_professional: style_professional.clone(),
        style_concise: style_concise.clone(),
        style_friendly: style_friendly.clone(),
    });

    // ── Build tray icon ─────────────────────────────────────────
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("Channely — Active")
        .icon_as_template(true)
        .show_menu_on_left_click(true)
        .on_menu_event(move |app, event| {
            let id = event.id.as_ref();
            match id {
                // ── Quit ────────────────────────────────────────
                "quit" => {
                    app.exit(0);
                }

                // ── Settings ────────────────────────────────────
                "settings" => {
                    let app = app.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = crate::commands::settings::open_settings(app).await {
                            log::error!("Failed to open settings: {e}");
                        }
                    });
                }

                // ── Toggle pause/resume ─────────────────────────
                "toggle" => {
                    handle_toggle(app);
                }

                // ── Style selection ─────────────────────────────
                s if s.starts_with("style_") => {
                    handle_style_change(app, s);
                }

                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}

/// Handle the toggle (pause/resume) action.
fn handle_toggle(app: &tauri::AppHandle) {
    let now_paused = state::toggle_paused();

    if now_paused {
        // Unregister hotkey
        if let Err(e) = hotkey::handler::unregister_all(app) {
            log::error!("Failed to unregister hotkey: {e}");
        }
        info!("Channely paused — hotkey unregistered");
    } else {
        // Re-register hotkey
        if let Err(e) = hotkey::handler::register_hotkey(app) {
            log::error!("Failed to re-register hotkey: {e}");
        }
        info!("Channely resumed — hotkey registered");
    }

    // Update tray menu items dynamically
    update_tray_after_toggle(app, now_paused);
}

/// Update tray status item, toggle text, and tooltip after pause/resume.
fn update_tray_after_toggle(app: &tauri::AppHandle, paused: bool) {
    // Update tooltip on the tray icon itself
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let tooltip = if paused {
            "Channely — Paused"
        } else {
            "Channely — Active"
        };
        let _ = tray.set_tooltip(Some(tooltip));
    }

    // Update the status and toggle menu items via managed state
    if let Some(menu_state) = app.try_state::<TrayMenuState>() {
        let status_text = if paused {
            "⏸ Channely Paused"
        } else {
            "✓ Channely Active"
        };
        let _ = menu_state.status.set_text(status_text);

        let toggle_text = if paused {
            "Resume Channely"
        } else {
            "Pause Channely"
        };
        let _ = menu_state.toggle.set_text(toggle_text);
    }
}

/// Handle a style-radio change from the submenu.
fn handle_style_change(app: &tauri::AppHandle, selected_id: &str) {
    let style_name = match selected_id {
        "style_casual" => "Casual",
        "style_professional" => "Professional",
        "style_concise" => "Concise",
        "style_friendly" => "Friendly",
        _ => return,
    };

    info!("Style changed to: {style_name}");

    // Update radio-like check state via managed refs
    if let Some(menu_state) = app.try_state::<TrayMenuState>() {
        let _ = menu_state
            .style_casual
            .set_checked(selected_id == "style_casual");
        let _ = menu_state
            .style_professional
            .set_checked(selected_id == "style_professional");
        let _ = menu_state
            .style_concise
            .set_checked(selected_id == "style_concise");
        let _ = menu_state
            .style_friendly
            .set_checked(selected_id == "style_friendly");

        // Update submenu label to show current style
        let _ = menu_state
            .style_submenu
            .set_text(format!("Style: {style_name}"));
    }

    // Also update the config's default_style in managed state
    if let Some(config_state) = app.try_state::<crate::config::ConfigState>() {
        if let Ok(mut config) = config_state.0.lock() {
            config.ai.default_style = style_name.to_lowercase();
        }
    }
}

/// Update the "Texts improved" counter in the tray menu.
/// Called after each successful proofread from the hotkey handler.
pub fn update_counter<R: Runtime>(app: &tauri::AppHandle<R>) {
    let count = state::improvement_count();

    // We need Wry-specific TrayMenuState, so this only works on desktop.
    // For the generic runtime case, we attempt the managed state lookup.
    if let Some(menu_state) = app.try_state::<TrayMenuState>() {
        let _ = menu_state
            .counter
            .set_text(format!("Texts improved: {count}"));
    }
}

#[cfg(test)]
mod tests {
    use crate::tray::state;

    // These are integration-level tests that need a running Tauri app.
    // We mark them #[ignore] so `cargo test` passes without a display.

    #[test]
    #[ignore]
    fn tray_toggle_pause_unregisters_hotkey() {
        // Requires a running Tauri app with tray + global shortcut.
        // Manual verification: press toggle → hotkey stops working.
    }

    #[test]
    #[ignore]
    fn tray_toggle_resume_registers_hotkey() {
        // Requires a running Tauri app with tray + global shortcut.
        // Manual verification: press toggle again → hotkey works.
    }

    #[test]
    #[ignore]
    fn tray_open_settings_creates_window() {
        // Requires a running Tauri app.
        // Manual verification: click "Settings..." → settings window appears.
    }

    #[test]
    fn counter_updates_after_increment() {
        let _guard = state::test_lock_guard();
        // Unit-testable: increment the counter and verify the value.
        state::reset_improvements();
        assert_eq!(state::improvement_count(), 0);

        state::increment_improvements();
        assert_eq!(state::improvement_count(), 1);

        state::increment_improvements();
        state::increment_improvements();
        assert_eq!(state::improvement_count(), 3);
    }

    #[test]
    fn toggle_pause_state_round_trip() {
        let _guard = state::test_lock_guard();
        // Verify the state module correctly toggles.
        state::set_paused(false);
        assert!(!state::is_paused());

        let now = state::toggle_paused();
        assert!(now); // now paused
        assert!(state::is_paused());

        let now = state::toggle_paused();
        assert!(!now); // now active
        assert!(!state::is_paused());
    }
}
