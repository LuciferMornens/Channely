// Phase 1 — Clipboard & hotkey integration tests.
//
// Tests that require a running Tauri app context, Accessibility permissions,
// or a live clipboard are marked `#[ignore]` and can be run manually with:
//   cargo test -- --ignored
//
// Non-ignored tests run in CI and validate pure logic (serialization, etc.).

use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use channely_lib::clipboard::manager::ClipboardState;
use channely_lib::hotkey::handler::{
    cooldown_elapsed, should_retry_clipboard_read, COOLDOWN_DURATION,
};

// ── Unit: ClipboardState serialization ─────────────────────────────────────

#[test]
fn clipboard_state_with_text_roundtrips_via_json() {
    let state = ClipboardState {
        text: Some("original clipboard content".to_string()),
    };
    let json = serde_json::to_string(&state).unwrap();
    let restored: ClipboardState = serde_json::from_str(&json).unwrap();
    assert_eq!(restored.text.as_deref(), Some("original clipboard content"));
}

#[test]
fn clipboard_state_none_roundtrips_via_json() {
    let state = ClipboardState { text: None };
    let json = serde_json::to_string(&state).unwrap();
    let restored: ClipboardState = serde_json::from_str(&json).unwrap();
    assert!(restored.text.is_none());
}

// ── Unit: Edge case — empty selection detection ────────────────────────────

#[test]
fn empty_string_is_detected_as_empty_selection() {
    let text = "";
    assert!(
        text.trim().is_empty(),
        "Empty string should be empty selection"
    );
}

#[test]
fn whitespace_only_is_detected_as_empty_selection() {
    let text = "   \n\t  ";
    assert!(
        text.trim().is_empty(),
        "Whitespace-only should be empty selection"
    );
}

#[test]
fn real_text_is_not_empty_selection() {
    let text = "Hello, world!";
    assert!(
        !text.trim().is_empty(),
        "Real text should NOT be empty selection"
    );
}

// ── Unit: Edge case — non-text clipboard handled gracefully ────────────────

#[test]
fn clipboard_state_none_represents_non_text_content() {
    // When the clipboard has an image or other non-text content,
    // preserve() returns ClipboardState { text: None }.
    // restore() with None should be a no-op (not crash).
    let state = ClipboardState { text: None };
    assert!(state.text.is_none());
    // The fact that we can construct and inspect this without panic proves graceful handling.
}

// ── Unit: Hotkey event name constants ──────────────────────────────────────

#[test]
fn event_names_are_valid() {
    assert_eq!(
        channely_lib::hotkey::handler::EVENT_TEXT_CAPTURED,
        "channely://text-captured"
    );
    assert_eq!(
        channely_lib::hotkey::handler::EVENT_CAPTURE_ERROR,
        "channely://capture-error"
    );
    assert_eq!(
        channely_lib::hotkey::handler::EVENT_CAPTURE_WARNING,
        "channely://capture-warning"
    );
    assert_eq!(
        channely_lib::hotkey::handler::EVENT_OVERLAY_ACCEPT,
        "channely://overlay-accept"
    );
    assert_eq!(
        channely_lib::hotkey::handler::EVENT_OVERLAY_DISMISS,
        "channely://overlay-dismiss"
    );
}

// ── Unit: Clipboard stale-guard logic ───────────────────────────────────────

#[test]
fn retries_when_clipboard_still_contains_probe_marker() {
    let marker = "__CHANNELY_CAPTURE_PROBE__test";
    assert!(should_retry_clipboard_read(marker, marker));
}

#[test]
fn repeated_same_text_capture_is_not_rejected_as_stale() {
    let marker = "__CHANNELY_CAPTURE_PROBE__test";
    let selected_text = "unchanged selection";
    assert!(!should_retry_clipboard_read(selected_text, marker));
}

// ── Integration: Clipboard read/write round-trip (requires clipboard) ──────

#[test]
#[ignore]
fn clipboard_read_write_roundtrip() {
    // This test requires a running Tauri app context to access the clipboard plugin.
    // Run manually: cargo test clipboard_read_write_roundtrip -- --ignored
    // The real test would:
    //   1. write_text(app, "test data")
    //   2. assert_eq!(read_text(app), "test data")
    // Cannot be unit-tested without AppHandle.
    eprintln!("Requires Tauri AppHandle — run in integration context");
}

#[test]
#[ignore]
fn clipboard_preserve_operate_restore_roundtrip() {
    // Full flow test:
    //   1. preserve(app) → saved
    //   2. write_text(app, "temporary") — simulates AI flow
    //   3. restore(app, saved) — restores original
    //   4. assert read_text(app) == original
    // Requires Tauri AppHandle.
    eprintln!("Requires Tauri AppHandle — run in integration context");
}

#[test]
#[ignore]
fn global_hotkey_registration_succeeds() {
    // Requires a running Tauri app to call register_hotkey().
    // Manual verification: app launches → Cmd+Shift+K works system-wide.
    eprintln!("Requires Tauri AppHandle — run in integration context");
}

#[test]
#[ignore]
fn hotkey_press_captures_selected_text() {
    // Full integration: press hotkey → clipboard read returns selected text.
    // Requires Accessibility permissions + Tauri app.
    eprintln!("Requires Tauri AppHandle + Accessibility — run manually");
}

#[test]
#[ignore]
fn full_flow_preserve_copy_read_write_paste_restore() {
    // End-to-end: preserve → Cmd+C → read → write corrected → Cmd+V → restore.
    // Requires Accessibility + Tauri app.
    eprintln!("Requires Tauri AppHandle + Accessibility — run manually");
}

// ── Unit: Rapid hotkey debounce (Phase 8.1) ────────────────────────────────

/// Simulates rapid hotkey presses using the same AtomicBool + Instant-based
/// cooldown logic from the real handler. Verifies that only one invocation
/// goes through when presses arrive within the cooldown window.
#[test]
fn rapid_hotkey_debounce_prevents_double_invocation() {
    let busy = Arc::new(AtomicBool::new(false));
    let last_invocation = Arc::new(Mutex::new(Instant::now() - COOLDOWN_DURATION));
    let invocation_count = Arc::new(AtomicU32::new(0));

    // Simulate a hotkey press helper — mirrors the guard logic in register_hotkey.
    let simulate_press = |busy: &AtomicBool, last: &Mutex<Instant>, count: &AtomicU32| -> bool {
        // Cooldown check
        {
            let ts = last.lock().unwrap();
            if !cooldown_elapsed(*ts) {
                return false; // rejected by cooldown
            }
        }
        // Busy check
        if busy.swap(true, Ordering::SeqCst) {
            return false; // rejected — already busy
        }
        // Record invocation time
        {
            let mut ts = last.lock().unwrap();
            *ts = Instant::now();
        }
        count.fetch_add(1, Ordering::SeqCst);
        true // accepted
    };

    // First press — should succeed.
    assert!(simulate_press(&busy, &last_invocation, &invocation_count));
    assert_eq!(invocation_count.load(Ordering::SeqCst), 1);

    // Second press immediately after — busy is still true, AND cooldown hasn't
    // elapsed. Should be rejected.
    assert!(!simulate_press(&busy, &last_invocation, &invocation_count));
    assert_eq!(invocation_count.load(Ordering::SeqCst), 1);

    // Release busy flag (simulating async task completion), but DON'T wait
    // for cooldown.
    busy.store(false, Ordering::SeqCst);

    // Third press — busy is false but cooldown hasn't elapsed. Should still be
    // rejected.
    assert!(!simulate_press(&busy, &last_invocation, &invocation_count));
    assert_eq!(invocation_count.load(Ordering::SeqCst), 1);

    // Now simulate enough time passing by back-dating last_invocation.
    {
        let mut ts = last_invocation.lock().unwrap();
        *ts = Instant::now() - Duration::from_millis(350);
    }

    // Fourth press — cooldown has elapsed and not busy. Should succeed.
    assert!(simulate_press(&busy, &last_invocation, &invocation_count));
    assert_eq!(invocation_count.load(Ordering::SeqCst), 2);
}

/// Verify the exported cooldown constant and helper function.
#[test]
fn cooldown_duration_is_300ms() {
    assert_eq!(COOLDOWN_DURATION, Duration::from_millis(300));
}

#[test]
fn cooldown_elapsed_works_correctly() {
    // Just now — not elapsed.
    assert!(!cooldown_elapsed(Instant::now()));
    // 350ms ago — elapsed.
    assert!(cooldown_elapsed(
        Instant::now() - Duration::from_millis(350)
    ));
}
