use tauri::{command, AppHandle, Manager};

use crate::performance::{self, MemoryProfile, PerformanceState, StartupReport};

#[command]
pub fn get_startup_performance(app: AppHandle) -> Result<StartupReport, String> {
    let state = app.state::<PerformanceState>();
    Ok(performance::startup_report(&state))
}

#[command]
pub fn get_memory_profile() -> Result<MemoryProfile, String> {
    performance::memory_profile()
}
