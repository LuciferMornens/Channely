use std::time::Duration;

use channely_lib::performance::{
    self, parse_ps_rss_kb, record_tray_ready, startup_report, within_cold_start_target,
    PerformanceState, COLD_START_TARGET_MS,
};

#[test]
fn cold_start_target_predicate_behaves_as_expected() {
    assert!(within_cold_start_target(750));
    assert!(within_cold_start_target(COLD_START_TARGET_MS));
    assert!(!within_cold_start_target(COLD_START_TARGET_MS + 1));
}

#[test]
fn startup_report_flags_tray_target_result() {
    let state = PerformanceState::default();
    record_tray_ready(&state, Duration::from_millis(980));
    let report = startup_report(&state);
    assert_eq!(report.tray_ready_ms, Some(980));
    assert!(report.tray_within_target);
}

#[test]
fn parse_ps_rss_handles_plain_and_status_like_formats() {
    assert_eq!(parse_ps_rss_kb("  48200\n"), Some(48_200));
    assert_eq!(parse_ps_rss_kb("VmRSS:\t5120 kB"), Some(5_120));
    assert_eq!(parse_ps_rss_kb("unknown"), None);
}

#[test]
fn memory_profile_returns_nonzero_for_running_process() {
    let profile = performance::memory_profile().expect("memory profile should be available");
    assert!(profile.resident_bytes > 0);
    assert!(profile.resident_mb > 0.0);
}
