use serde::Serialize;

/// Upper bound for input text passed to the proofreading model.
///
/// This limit keeps latency and token usage predictable while still supporting
/// long paragraphs.
pub const MAX_INPUT_CHARS: usize = 5_000;

/// Metadata emitted when user input needs truncation.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct TextLimitWarning {
    pub original_chars: usize,
    pub truncated_chars: usize,
    pub max_chars: usize,
}

impl TextLimitWarning {
    pub fn to_user_message(&self) -> String {
        format!(
            "Long selection detected ({} chars). Channely used the first {} chars to keep responses fast.",
            self.original_chars, self.max_chars
        )
    }
}

/// Result of applying long-text safeguards to input text.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreparedText {
    pub text: String,
    pub warning: Option<TextLimitWarning>,
}

/// Prepare text for proofreading, truncating at `MAX_INPUT_CHARS` when needed.
pub fn prepare_input_text(text: &str) -> PreparedText {
    let original_chars = text.chars().count();
    if original_chars <= MAX_INPUT_CHARS {
        return PreparedText {
            text: text.to_string(),
            warning: None,
        };
    }

    let truncated: String = text.chars().take(MAX_INPUT_CHARS).collect();
    let truncated_chars = truncated.chars().count();

    PreparedText {
        text: truncated,
        warning: Some(TextLimitWarning {
            original_chars,
            truncated_chars,
            max_chars: MAX_INPUT_CHARS,
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn short_text_is_not_modified() {
        let input = "Hello world";
        let prepared = prepare_input_text(input);
        assert_eq!(prepared.text, input);
        assert!(prepared.warning.is_none());
    }

    #[test]
    fn long_text_is_truncated_with_warning() {
        let input = "a".repeat(MAX_INPUT_CHARS + 250);
        let prepared = prepare_input_text(&input);
        assert_eq!(prepared.text.chars().count(), MAX_INPUT_CHARS);
        assert!(prepared.warning.is_some());
        let warning = prepared.warning.unwrap();
        assert_eq!(warning.original_chars, MAX_INPUT_CHARS + 250);
        assert_eq!(warning.truncated_chars, MAX_INPUT_CHARS);
        assert_eq!(warning.max_chars, MAX_INPUT_CHARS);
        assert!(warning
            .to_user_message()
            .contains("Long selection detected"));
    }

    #[test]
    fn truncation_is_unicode_safe() {
        let input = "🙂".repeat(MAX_INPUT_CHARS + 5);
        let prepared = prepare_input_text(&input);
        assert_eq!(prepared.text.chars().count(), MAX_INPUT_CHARS);
        assert!(prepared.warning.is_some());
    }
}
