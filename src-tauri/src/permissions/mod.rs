use serde::Serialize;

/// Deep link for macOS System Settings > Privacy & Security > Accessibility.
pub const ACCESSIBILITY_SETTINGS_URL: &str =
    "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct FocusModeStatus {
    pub supported: bool,
    pub do_not_disturb: bool,
    pub source: String,
}

/// Returns whether macOS Accessibility permissions are granted for this process.
pub fn is_accessibility_permission_granted() -> bool {
    status_from_probe_result(accessibility_probe())
}

/// Open the macOS Accessibility settings screen for the user to grant permission.
pub fn open_accessibility_settings() -> Result<(), String> {
    open_url(ACCESSIBILITY_SETTINGS_URL)
}

pub fn focus_mode_status() -> FocusModeStatus {
    detect_focus_mode()
}

fn status_from_probe_result(status: Option<bool>) -> bool {
    status.unwrap_or(false)
}

fn parse_defaults_bool(raw: &str) -> Option<bool> {
    match raw.trim().trim_matches('"').to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "on" => Some(true),
        "0" | "false" | "no" | "off" => Some(false),
        _ => None,
    }
}

#[cfg(target_os = "macos")]
fn read_defaults_bool(domain: &str, key: &str) -> Option<bool> {
    let output = std::process::Command::new("defaults")
        .args(["-currentHost", "read", domain, key])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let raw = String::from_utf8_lossy(&output.stdout);
    parse_defaults_bool(&raw)
}

#[cfg(target_os = "macos")]
fn detect_focus_mode() -> FocusModeStatus {
    if let Some(value) = read_defaults_bool("com.apple.notificationcenterui", "doNotDisturb") {
        return FocusModeStatus {
            supported: true,
            do_not_disturb: value,
            source: "notificationcenterui".to_string(),
        };
    }

    FocusModeStatus {
        supported: true,
        do_not_disturb: false,
        source: "best-effort-unavailable".to_string(),
    }
}

#[cfg(not(target_os = "macos"))]
fn detect_focus_mode() -> FocusModeStatus {
    FocusModeStatus {
        supported: false,
        do_not_disturb: false,
        source: "unsupported-platform".to_string(),
    }
}

#[cfg(target_os = "macos")]
fn accessibility_probe() -> Option<bool> {
    Some(ax_is_process_trusted())
}

#[cfg(not(target_os = "macos"))]
fn accessibility_probe() -> Option<bool> {
    None
}

#[cfg(target_os = "macos")]
fn ax_is_process_trusted() -> bool {
    // SAFETY: `AXIsProcessTrusted` is a pure C function from the
    // ApplicationServices framework and takes no pointers or references.
    unsafe { AXIsProcessTrusted() }
}

fn open_url(url: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        let status = Command::new("open")
            .arg(url)
            .status()
            .map_err(|e| format!("Failed to launch System Settings: {e}"))?;

        if status.success() {
            Ok(())
        } else {
            Err(format!(
                "System Settings command exited with status: {status}"
            ))
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = url;
        Err("Accessibility settings deep link is only supported on macOS".to_string())
    }
}

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> bool;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn permission_status_true_maps_to_granted() {
        assert!(status_from_probe_result(Some(true)));
    }

    #[test]
    fn permission_status_false_maps_to_not_granted() {
        assert!(!status_from_probe_result(Some(false)));
    }

    #[test]
    fn missing_probe_defaults_to_not_granted() {
        assert!(!status_from_probe_result(None));
    }

    #[test]
    fn accessibility_settings_url_points_to_privacy_accessibility() {
        assert!(ACCESSIBILITY_SETTINGS_URL.contains("Privacy_Accessibility"));
    }

    #[test]
    fn parse_defaults_bool_handles_standard_values() {
        assert_eq!(parse_defaults_bool("1"), Some(true));
        assert_eq!(parse_defaults_bool("0"), Some(false));
        assert_eq!(parse_defaults_bool("true"), Some(true));
        assert_eq!(parse_defaults_bool("false"), Some(false));
        assert_eq!(parse_defaults_bool("\"on\""), Some(true));
        assert_eq!(parse_defaults_bool("\"off\""), Some(false));
        assert_eq!(parse_defaults_bool("maybe"), None);
    }
}
