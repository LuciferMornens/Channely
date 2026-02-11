// Simulated keystrokes — Cmd+C (copy) and Cmd+V (paste).
//
// On macOS we dispatch via `osascript` + System Events. Accessibility
// permission is required.

/// Simulate Cmd+C (copy) keystroke.
pub fn simulate_copy() -> Result<(), String> {
    send_macos_keystroke("c")
}

/// Simulate Cmd+V (paste) keystroke.
pub fn simulate_paste() -> Result<(), String> {
    send_macos_keystroke("v")
}

#[cfg(target_os = "macos")]
fn send_macos_keystroke(key: &str) -> Result<(), String> {
    let script =
        format!("tell application \"System Events\" to keystroke \"{key}\" using {{command down}}");

    let status = std::process::Command::new("osascript")
        .arg("-e")
        .arg(script)
        .status()
        .map_err(|e| format!("Failed to run osascript for Cmd+{key}: {e}"))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "osascript failed for Cmd+{key} (accessibility permission needed?)"
        ))
    }
}

#[cfg(not(target_os = "macos"))]
fn send_macos_keystroke(_key: &str) -> Result<(), String> {
    Err("Simulated keystrokes are currently supported only on macOS".to_string())
}

#[cfg(test)]
mod tests {
    // NOTE: These tests require macOS Accessibility permissions and cannot
    // run in CI. They are marked #[ignore].

    #[test]
    #[ignore]
    fn simulate_copy_does_not_panic() {
        // Just verifies no panic — actual clipboard effect needs Accessibility.
        let result = super::simulate_copy();
        // We accept either Ok or an Err about permissions.
        assert!(
            result.is_ok() || result.as_ref().unwrap_err().contains("permission"),
            "Unexpected error: {result:?}"
        );
    }

    #[test]
    #[ignore]
    fn simulate_paste_does_not_panic() {
        let result = super::simulate_paste();
        assert!(
            result.is_ok() || result.as_ref().unwrap_err().contains("permission"),
            "Unexpected error: {result:?}"
        );
    }
}
