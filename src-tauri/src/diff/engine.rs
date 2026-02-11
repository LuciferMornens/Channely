// Word-level text diffing engine using the `similar` crate

use serde::{Deserialize, Serialize};
use similar::{ChangeTag, TextDiff};

/// The kind of change in a diff segment
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiffKind {
    Unchanged,
    Added,
    Removed,
}

/// A segment of a diff result
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DiffSegment {
    pub text: String,
    pub kind: DiffKind,
}

/// Compute a word-level diff between original and improved text.
///
/// Returns a `Vec<DiffSegment>` with consecutive segments of the same kind
/// merged together. Edge cases:
/// - Both empty → empty vec
/// - Identical → single `Unchanged` segment
/// - Empty original → all `Added`
/// - Empty improved → all `Removed`
pub fn compute_diff(original: &str, improved: &str) -> Vec<DiffSegment> {
    // Both empty
    if original.is_empty() && improved.is_empty() {
        return vec![];
    }

    let diff = TextDiff::from_words(original, improved);
    let mut segments: Vec<DiffSegment> = Vec::new();

    for change in diff.iter_all_changes() {
        let kind = match change.tag() {
            ChangeTag::Equal => DiffKind::Unchanged,
            ChangeTag::Insert => DiffKind::Added,
            ChangeTag::Delete => DiffKind::Removed,
        };
        let text = change.value().to_string();

        // Merge consecutive segments of the same kind
        if let Some(last) = segments.last_mut() {
            if last.kind == kind {
                last.text.push_str(&text);
                continue;
            }
        }

        segments.push(DiffSegment { text, kind });
    }

    segments
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn simple_grammar_fix() {
        // "i dont" → "I don't"
        let segments = compute_diff("i dont", "I don't");

        // Should contain removed and added segments
        let has_removed = segments.iter().any(|s| s.kind == DiffKind::Removed);
        let has_added = segments.iter().any(|s| s.kind == DiffKind::Added);
        assert!(has_removed, "Should have removed segments");
        assert!(has_added, "Should have added segments");

        // Reconstruct original from unchanged + removed
        let original: String = segments
            .iter()
            .filter(|s| s.kind != DiffKind::Added)
            .map(|s| s.text.as_str())
            .collect();
        assert_eq!(original, "i dont");

        // Reconstruct improved from unchanged + added
        let improved: String = segments
            .iter()
            .filter(|s| s.kind != DiffKind::Removed)
            .map(|s| s.text.as_str())
            .collect();
        assert_eq!(improved, "I don't");
    }

    #[test]
    fn multiple_changes_across_sentence() {
        let original = "i dont want extension coz, for example";
        let improved = "I don't want an extension because, for example";
        let segments = compute_diff(original, improved);

        // Verify roundtrip
        let reconstructed_original: String = segments
            .iter()
            .filter(|s| s.kind != DiffKind::Added)
            .map(|s| s.text.as_str())
            .collect();
        assert_eq!(reconstructed_original, original);

        let reconstructed_improved: String = segments
            .iter()
            .filter(|s| s.kind != DiffKind::Removed)
            .map(|s| s.text.as_str())
            .collect();
        assert_eq!(reconstructed_improved, improved);

        // Should have at least some unchanged parts ("want", "for example")
        let has_unchanged = segments.iter().any(|s| s.kind == DiffKind::Unchanged);
        assert!(has_unchanged);
    }

    #[test]
    fn identical_texts_produce_all_unchanged() {
        let text = "Hello, world! This is a test.";
        let segments = compute_diff(text, text);

        assert_eq!(segments.len(), 1);
        assert_eq!(segments[0].kind, DiffKind::Unchanged);
        assert_eq!(segments[0].text, text);
    }

    #[test]
    fn completely_different_texts() {
        let segments = compute_diff("hello world", "goodbye universe");

        // Should have removed and added but no unchanged
        let has_removed = segments.iter().any(|s| s.kind == DiffKind::Removed);
        let has_added = segments.iter().any(|s| s.kind == DiffKind::Added);
        assert!(has_removed);
        assert!(has_added);

        // Roundtrip
        let original: String = segments
            .iter()
            .filter(|s| s.kind != DiffKind::Added)
            .map(|s| s.text.as_str())
            .collect();
        assert_eq!(original, "hello world");

        let improved: String = segments
            .iter()
            .filter(|s| s.kind != DiffKind::Removed)
            .map(|s| s.text.as_str())
            .collect();
        assert_eq!(improved, "goodbye universe");
    }

    #[test]
    fn both_empty() {
        let segments = compute_diff("", "");
        assert!(segments.is_empty());
    }

    #[test]
    fn empty_original() {
        let segments = compute_diff("", "hello world");
        assert!(!segments.is_empty());

        // Everything should be Added
        for seg in &segments {
            assert_eq!(seg.kind, DiffKind::Added);
        }

        let text: String = segments.iter().map(|s| s.text.as_str()).collect();
        assert_eq!(text, "hello world");
    }

    #[test]
    fn empty_improved() {
        let segments = compute_diff("hello world", "");
        assert!(!segments.is_empty());

        // Everything should be Removed
        for seg in &segments {
            assert_eq!(seg.kind, DiffKind::Removed);
        }

        let text: String = segments.iter().map(|s| s.text.as_str()).collect();
        assert_eq!(text, "hello world");
    }

    #[test]
    fn punctuation_only_changes() {
        // "hello world" → "hello, world"
        let segments = compute_diff("hello world", "hello, world");

        // Roundtrip
        let original: String = segments
            .iter()
            .filter(|s| s.kind != DiffKind::Added)
            .map(|s| s.text.as_str())
            .collect();
        assert_eq!(original, "hello world");

        let improved: String = segments
            .iter()
            .filter(|s| s.kind != DiffKind::Removed)
            .map(|s| s.text.as_str())
            .collect();
        assert_eq!(improved, "hello, world");

        // Should detect a change (not all unchanged)
        let has_changes = segments.iter().any(|s| s.kind != DiffKind::Unchanged);
        assert!(has_changes, "Punctuation change should be detected");
    }

    #[test]
    fn word_reordering_produces_readable_diff() {
        let original = "the quick brown fox";
        let improved = "the brown quick fox";
        let segments = compute_diff(original, improved);

        // Should have some changes
        let has_changes = segments.iter().any(|s| s.kind != DiffKind::Unchanged);
        assert!(has_changes);

        // Roundtrip
        let reconstructed_original: String = segments
            .iter()
            .filter(|s| s.kind != DiffKind::Added)
            .map(|s| s.text.as_str())
            .collect();
        assert_eq!(reconstructed_original, original);

        let reconstructed_improved: String = segments
            .iter()
            .filter(|s| s.kind != DiffKind::Removed)
            .map(|s| s.text.as_str())
            .collect();
        assert_eq!(reconstructed_improved, improved);
    }

    #[test]
    fn consecutive_segments_are_merged() {
        let segments = compute_diff("hello world", "hello world");
        // Should be exactly 1 merged unchanged segment, not many
        assert_eq!(segments.len(), 1);
        assert_eq!(segments[0].kind, DiffKind::Unchanged);
    }

    #[test]
    fn whitespace_preserved_in_diff() {
        let original = "hello   world";
        let improved = "hello   world";
        let segments = compute_diff(original, improved);
        assert_eq!(segments.len(), 1);
        assert_eq!(segments[0].text, "hello   world");
    }

    #[test]
    fn serialization_uses_lowercase_kind() {
        let segment = DiffSegment {
            text: "hello".to_string(),
            kind: DiffKind::Added,
        };
        let json = serde_json::to_string(&segment).unwrap();
        assert!(
            json.contains("\"added\""),
            "kind should serialize as lowercase: {json}"
        );

        let segment2 = DiffSegment {
            text: "world".to_string(),
            kind: DiffKind::Removed,
        };
        let json2 = serde_json::to_string(&segment2).unwrap();
        assert!(
            json2.contains("\"removed\""),
            "kind should serialize as lowercase: {json2}"
        );

        let segment3 = DiffSegment {
            text: "test".to_string(),
            kind: DiffKind::Unchanged,
        };
        let json3 = serde_json::to_string(&segment3).unwrap();
        assert!(
            json3.contains("\"unchanged\""),
            "kind should serialize as lowercase: {json3}"
        );
    }
}
