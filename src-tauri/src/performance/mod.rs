use serde::Serialize;
use std::process::Command;
use std::sync::Mutex;
use std::time::Duration;

#[cfg(target_os = "linux")]
use std::fs;

pub const COLD_START_TARGET_MS: u64 = 1_000;
pub const IDLE_MEMORY_TARGET_BYTES: u64 = 50 * 1024 * 1024;

#[derive(Debug, Clone, Default)]
pub struct StartupTimeline {
    pub tray_ready_ms: Option<u64>,
    pub hotkey_ready_ms: Option<u64>,
}

/// Managed application performance state.
pub struct PerformanceState(pub Mutex<StartupTimeline>);

impl Default for PerformanceState {
    fn default() -> Self {
        Self(Mutex::new(StartupTimeline::default()))
    }
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct StartupReport {
    pub tray_ready_ms: Option<u64>,
    pub hotkey_ready_ms: Option<u64>,
    pub tray_within_target: bool,
    pub cold_start_target_ms: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct MemoryProfile {
    pub resident_bytes: u64,
    pub resident_mb: f64,
    pub idle_target_bytes: u64,
    pub within_idle_target: bool,
    pub source: String,
}

pub fn duration_to_ms(duration: Duration) -> u64 {
    duration.as_millis() as u64
}

pub fn within_cold_start_target(ms: u64) -> bool {
    ms <= COLD_START_TARGET_MS
}

pub fn record_tray_ready(state: &PerformanceState, elapsed: Duration) {
    if let Ok(mut timeline) = state.0.lock() {
        timeline.tray_ready_ms = Some(duration_to_ms(elapsed));
    }
}

pub fn record_hotkey_ready(state: &PerformanceState, elapsed: Duration) {
    if let Ok(mut timeline) = state.0.lock() {
        timeline.hotkey_ready_ms = Some(duration_to_ms(elapsed));
    }
}

pub fn startup_report(state: &PerformanceState) -> StartupReport {
    if let Ok(timeline) = state.0.lock() {
        return StartupReport {
            tray_ready_ms: timeline.tray_ready_ms,
            hotkey_ready_ms: timeline.hotkey_ready_ms,
            tray_within_target: timeline
                .tray_ready_ms
                .map(within_cold_start_target)
                .unwrap_or(false),
            cold_start_target_ms: COLD_START_TARGET_MS,
        };
    }

    StartupReport {
        tray_ready_ms: None,
        hotkey_ready_ms: None,
        tray_within_target: false,
        cold_start_target_ms: COLD_START_TARGET_MS,
    }
}

pub fn parse_ps_rss_kb(output: &str) -> Option<u64> {
    output
        .split_whitespace()
        .find_map(|part| part.parse::<u64>().ok())
}

#[cfg(target_os = "macos")]
fn current_resident_memory_bytes() -> Result<(u64, String), String> {
    let pid = std::process::id().to_string();
    let output = Command::new("ps")
        .args(["-o", "rss=", "-p", &pid])
        .output()
        .map_err(|e| format!("Failed to run ps for memory profile: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "ps exited with non-zero status while reading memory: {}",
            output.status
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let kb =
        parse_ps_rss_kb(&stdout).ok_or_else(|| "Failed to parse RSS output from ps".to_string())?;
    Ok((kb * 1024, "ps-rss".to_string()))
}

#[cfg(target_os = "linux")]
fn current_resident_memory_bytes() -> Result<(u64, String), String> {
    let status = fs::read_to_string("/proc/self/status")
        .map_err(|e| format!("Failed to read /proc/self/status: {e}"))?;

    let kb = status
        .lines()
        .find(|line| line.starts_with("VmRSS:"))
        .and_then(parse_ps_rss_kb)
        .ok_or_else(|| "VmRSS not found in /proc/self/status".to_string())?;

    Ok((kb * 1024, "procfs-vmrss".to_string()))
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn current_resident_memory_bytes() -> Result<(u64, String), String> {
    Err("Memory profiling is not supported on this platform".to_string())
}

pub fn memory_profile() -> Result<MemoryProfile, String> {
    let (resident_bytes, source) = current_resident_memory_bytes()?;
    let resident_mb = resident_bytes as f64 / (1024.0 * 1024.0);

    Ok(MemoryProfile {
        resident_bytes,
        resident_mb,
        idle_target_bytes: IDLE_MEMORY_TARGET_BYTES,
        within_idle_target: resident_bytes <= IDLE_MEMORY_TARGET_BYTES,
        source,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ps_rss_kb() {
        assert_eq!(parse_ps_rss_kb("  48320\n"), Some(48_320));
        assert_eq!(parse_ps_rss_kb("VmRSS:\t12500 kB"), Some(12_500));
        assert_eq!(parse_ps_rss_kb("not-a-number"), None);
    }

    #[test]
    fn cold_start_target_evaluation() {
        assert!(within_cold_start_target(900));
        assert!(within_cold_start_target(COLD_START_TARGET_MS));
        assert!(!within_cold_start_target(1_250));
    }

    #[test]
    fn startup_report_uses_target_logic() {
        let state = PerformanceState::default();
        record_tray_ready(&state, Duration::from_millis(950));
        let report = startup_report(&state);
        assert_eq!(report.tray_ready_ms, Some(950));
        assert!(report.tray_within_target);
    }
}
