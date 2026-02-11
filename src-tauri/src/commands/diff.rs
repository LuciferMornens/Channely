use crate::diff::engine::{self, DiffSegment};

#[tauri::command]
pub fn compute_diff(original: String, improved: String) -> Vec<DiffSegment> {
    engine::compute_diff(&original, &improved)
}
