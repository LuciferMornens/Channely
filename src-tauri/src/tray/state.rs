// Tray state — pause/resume and improvement counter
//
// Uses atomics so we can read/write from any thread without locking.

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

/// Whether Channely is currently paused (hotkey disabled).
static IS_PAUSED: AtomicBool = AtomicBool::new(false);

/// Number of texts improved in the current session.
static IMPROVEMENT_COUNT: AtomicUsize = AtomicUsize::new(0);

// ── Pause state ────────────────────────────────────────────────────

/// Returns `true` if Channely is currently paused.
pub fn is_paused() -> bool {
    IS_PAUSED.load(Ordering::SeqCst)
}

/// Set the paused state. Returns the previous value.
pub fn set_paused(paused: bool) -> bool {
    IS_PAUSED.swap(paused, Ordering::SeqCst)
}

/// Toggle pause state. Returns the *new* value.
pub fn toggle_paused() -> bool {
    let was_paused = IS_PAUSED.fetch_xor(true, Ordering::SeqCst);
    !was_paused
}

// ── Improvement counter ────────────────────────────────────────────

/// Get the current improvement count.
pub fn improvement_count() -> usize {
    IMPROVEMENT_COUNT.load(Ordering::SeqCst)
}

/// Increment the improvement counter by 1. Returns the new value.
pub fn increment_improvements() -> usize {
    IMPROVEMENT_COUNT.fetch_add(1, Ordering::SeqCst) + 1
}

/// Reset the improvement counter to 0.
pub fn reset_improvements() {
    IMPROVEMENT_COUNT.store(0, Ordering::SeqCst);
}

#[cfg(test)]
pub(crate) fn test_lock_guard() -> std::sync::MutexGuard<'static, ()> {
    use std::sync::{Mutex, OnceLock};

    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
        .lock()
        .expect("tray state test lock poisoned")
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Reset global statics before each test to avoid cross-test pollution.
    fn reset() {
        IS_PAUSED.store(false, Ordering::SeqCst);
        IMPROVEMENT_COUNT.store(0, Ordering::SeqCst);
    }

    // ── Pause state tests ──────────────────────────────────────────

    #[test]
    fn default_is_not_paused() {
        let _guard = test_lock_guard();
        reset();
        assert!(!is_paused());
    }

    #[test]
    fn set_paused_returns_previous_value() {
        let _guard = test_lock_guard();
        reset();
        let was = set_paused(true);
        assert!(!was);
        assert!(is_paused());

        let was = set_paused(false);
        assert!(was);
        assert!(!is_paused());
    }

    #[test]
    fn toggle_paused_flips_state() {
        let _guard = test_lock_guard();
        reset();
        assert!(!is_paused());

        let now_paused = toggle_paused();
        assert!(now_paused);
        assert!(is_paused());

        let now_paused = toggle_paused();
        assert!(!now_paused);
        assert!(!is_paused());
    }

    #[test]
    fn toggle_paused_double_toggle_returns_to_original() {
        let _guard = test_lock_guard();
        reset();
        let original = is_paused();
        toggle_paused();
        toggle_paused();
        assert_eq!(is_paused(), original);
    }

    // ── Improvement counter tests ──────────────────────────────────

    #[test]
    fn default_improvement_count_is_zero() {
        let _guard = test_lock_guard();
        reset();
        assert_eq!(improvement_count(), 0);
    }

    #[test]
    fn increment_improvements_returns_new_value() {
        let _guard = test_lock_guard();
        reset();
        assert_eq!(increment_improvements(), 1);
        assert_eq!(increment_improvements(), 2);
        assert_eq!(increment_improvements(), 3);
        assert_eq!(improvement_count(), 3);
    }

    #[test]
    fn reset_improvements_clears_counter() {
        let _guard = test_lock_guard();
        reset();
        increment_improvements();
        increment_improvements();
        assert_eq!(improvement_count(), 2);

        reset_improvements();
        assert_eq!(improvement_count(), 0);
    }

    #[test]
    fn improvement_counter_many_increments() {
        let _guard = test_lock_guard();
        reset();
        for _ in 0..100 {
            increment_improvements();
        }
        assert_eq!(improvement_count(), 100);
    }
}
