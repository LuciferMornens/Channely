// Cerebras AI types — request/response structures

use serde::{Deserialize, Serialize};

/// A chat message for the Cerebras API
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

/// Style presets for text improvement
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Style {
    Casual,
    Professional,
    Concise,
    Friendly,
}

impl Style {
    /// Parse a style string (case-insensitive) into a Style enum.
    /// Defaults to `Casual` on unrecognized input.
    pub fn from_str_lenient(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "professional" => Self::Professional,
            "concise" => Self::Concise,
            "friendly" => Self::Friendly,
            _ => Self::Casual,
        }
    }
}

/// Request body for Cerebras /chat/completions
#[derive(Debug, Serialize)]
pub struct CerebrasRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub stream: bool,
    pub max_completion_tokens: u32,
    pub temperature: f32,
    pub top_p: f32,
    pub reasoning_effort: String,
}

impl Default for CerebrasRequest {
    fn default() -> Self {
        Self {
            model: "gpt-oss-120b".to_string(),
            messages: Vec::new(),
            stream: true,
            max_completion_tokens: 32768,
            temperature: 1.0,
            top_p: 1.0,
            reasoning_effort: "high".to_string(),
        }
    }
}

/// Configuration for the Cerebras client (loaded from env / config)
#[derive(Debug, Clone)]
pub struct CerebrasConfig {
    pub api_key: String,
    pub model: String,
    pub reasoning_effort: String,
    pub max_completion_tokens: u32,
    pub timeout_seconds: u64,
}

impl Default for CerebrasConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            model: "gpt-oss-120b".to_string(),
            reasoning_effort: "high".to_string(),
            max_completion_tokens: 32768,
            timeout_seconds: 30,
        }
    }
}

/// Error type for Cerebras client operations
#[derive(Debug, thiserror::Error)]
pub enum CerebrasError {
    #[error("API key not set: {0}")]
    ApiKeyMissing(String),

    #[error("{0}")]
    Offline(String),

    #[error("Request failed: {0}")]
    RequestFailed(String),

    #[error("Request timed out after {0}s")]
    Timeout(u64),

    #[error("Rate limited: {0}")]
    RateLimited(String),

    #[error("Invalid response: {0}")]
    InvalidResponse(String),

    #[error("Stream error: {0}")]
    StreamError(String),
}

/// A single SSE delta chunk from the Cerebras streaming response
#[derive(Debug, Deserialize)]
pub struct StreamChunk {
    pub choices: Vec<StreamChoice>,
}

#[derive(Debug, Deserialize)]
pub struct StreamChoice {
    pub delta: StreamDelta,
}

#[derive(Debug, Deserialize)]
pub struct StreamDelta {
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub reasoning: Option<String>,
}

/// Error response body from the Cerebras API
#[derive(Debug, Deserialize)]
pub struct CerebrasApiError {
    pub error: Option<CerebrasApiErrorDetail>,
}

#[derive(Debug, Deserialize)]
pub struct CerebrasApiErrorDetail {
    pub message: Option<String>,
}

// ── Unit Tests ─────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chat_message_serialization_matches_cerebras_format() {
        let msg = ChatMessage {
            role: "system".to_string(),
            content: "You are a proofreader.".to_string(),
        };
        let json = serde_json::to_value(&msg).unwrap();
        assert_eq!(json["role"], "system");
        assert_eq!(json["content"], "You are a proofreader.");

        // Verify it round-trips
        let deserialized: ChatMessage = serde_json::from_value(json).unwrap();
        assert_eq!(deserialized, msg);
    }

    #[test]
    fn cerebras_request_defaults_have_reasoning_and_stream() {
        let req = CerebrasRequest::default();
        let json = serde_json::to_value(&req).unwrap();

        assert_eq!(json["model"], "gpt-oss-120b");
        assert_eq!(json["reasoning_effort"], "high");
        assert_eq!(json["stream"], true);
        assert_eq!(json["max_completion_tokens"], 32768);
        assert_eq!(json["temperature"], 1.0);
        assert_eq!(json["top_p"], 1.0);
    }

    #[test]
    fn style_from_str_lenient_parses_all_variants() {
        assert_eq!(Style::from_str_lenient("casual"), Style::Casual);
        assert_eq!(Style::from_str_lenient("Casual"), Style::Casual);
        assert_eq!(Style::from_str_lenient("professional"), Style::Professional);
        assert_eq!(Style::from_str_lenient("CONCISE"), Style::Concise);
        assert_eq!(Style::from_str_lenient("friendly"), Style::Friendly);
        assert_eq!(Style::from_str_lenient("unknown"), Style::Casual); // default
        assert_eq!(Style::from_str_lenient(""), Style::Casual);
    }

    #[test]
    fn cerebras_config_defaults() {
        let cfg = CerebrasConfig::default();
        assert_eq!(cfg.model, "gpt-oss-120b");
        assert_eq!(cfg.reasoning_effort, "high");
        assert_eq!(cfg.max_completion_tokens, 32768);
        assert_eq!(cfg.timeout_seconds, 30);
        assert!(cfg.api_key.is_empty());
    }
}
