// Integration tests for the diff engine

use channely_lib::diff::engine::{compute_diff, DiffKind, DiffSegment};

#[test]
fn integration_simple_grammar_fix() {
    let segments = compute_diff("i dont", "I don't");

    let original: String = segments
        .iter()
        .filter(|s| s.kind != DiffKind::Added)
        .map(|s| s.text.as_str())
        .collect();
    assert_eq!(original, "i dont");

    let improved: String = segments
        .iter()
        .filter(|s| s.kind != DiffKind::Removed)
        .map(|s| s.text.as_str())
        .collect();
    assert_eq!(improved, "I don't");
}

#[test]
fn integration_multiple_changes() {
    let original = "i dont want extension coz, for example";
    let improved = "I don't want an extension because, for example";
    let segments = compute_diff(original, improved);

    let rec_original: String = segments
        .iter()
        .filter(|s| s.kind != DiffKind::Added)
        .map(|s| s.text.as_str())
        .collect();
    assert_eq!(rec_original, original);

    let rec_improved: String = segments
        .iter()
        .filter(|s| s.kind != DiffKind::Removed)
        .map(|s| s.text.as_str())
        .collect();
    assert_eq!(rec_improved, improved);
}

#[test]
fn integration_identical_text() {
    let text = "Hello, world! This is a test sentence.";
    let segments = compute_diff(text, text);
    assert_eq!(segments.len(), 1);
    assert_eq!(segments[0].kind, DiffKind::Unchanged);
    assert_eq!(segments[0].text, text);
}

#[test]
fn integration_completely_different() {
    let segments = compute_diff("alpha beta gamma", "one two three");
    let has_removed = segments.iter().any(|s| s.kind == DiffKind::Removed);
    let has_added = segments.iter().any(|s| s.kind == DiffKind::Added);
    assert!(has_removed);
    assert!(has_added);
}

#[test]
fn integration_empty_inputs() {
    assert!(compute_diff("", "").is_empty());

    let added = compute_diff("", "new text");
    assert!(added.iter().all(|s| s.kind == DiffKind::Added));

    let removed = compute_diff("old text", "");
    assert!(removed.iter().all(|s| s.kind == DiffKind::Removed));
}

#[test]
fn integration_punctuation_change() {
    let segments = compute_diff("hello world", "hello, world");
    let has_changes = segments.iter().any(|s| s.kind != DiffKind::Unchanged);
    assert!(has_changes);
}

#[test]
fn integration_word_reorder() {
    let original = "red green blue";
    let improved = "green red blue";
    let segments = compute_diff(original, improved);

    let rec_original: String = segments
        .iter()
        .filter(|s| s.kind != DiffKind::Added)
        .map(|s| s.text.as_str())
        .collect();
    assert_eq!(rec_original, original);

    let rec_improved: String = segments
        .iter()
        .filter(|s| s.kind != DiffKind::Removed)
        .map(|s| s.text.as_str())
        .collect();
    assert_eq!(rec_improved, improved);
}

#[test]
fn integration_json_serialization() {
    let segment = DiffSegment {
        text: "test".to_string(),
        kind: DiffKind::Added,
    };
    let json = serde_json::to_value(&segment).unwrap();
    assert_eq!(json["kind"], "added");
    assert_eq!(json["text"], "test");
}
