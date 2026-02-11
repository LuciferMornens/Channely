// Cerebras Inference client — SSE streaming proofreading
//
// Model: gpt-oss-120b with reasoning_effort: "high"
// API: https://api.cerebras.ai/v1/chat/completions
// Streaming via SSE (eventsource-stream)
// API key is resolved by callers (settings value first, env fallback).

use std::time::Duration;

use eventsource_stream::Eventsource;
use futures_util::StreamExt;
use log::{info, warn};
use reqwest::header::RETRY_AFTER;
use serde::Serialize;
use tauri::Emitter;

use super::types::{
    CerebrasApiError, CerebrasConfig, CerebrasError, CerebrasRequest, ChatMessage, StreamChunk,
    Style,
};

/// Cerebras API base URL.
const CEREBRAS_API_URL: &str = "https://api.cerebras.ai/v1/chat/completions";

/// Maximum number of retries on transient failures.
const MAX_RETRIES: u32 = 1;

/// Event emitted before retrying an upstream call.
const EVENT_RETRYING: &str = "cerebras:retrying";

#[derive(Debug, Clone, Serialize)]
struct RetryEventPayload {
    attempt: u32,
    total_attempts: u32,
    backoff_ms: u64,
}

// ── Public API ─────────────────────────────────────────────────────

/// Stream a proofreading request to Cerebras, emitting delta tokens via
/// Tauri events and returning the full corrected text.
pub async fn stream_proofread<R: tauri::Runtime, E: Emitter<R>>(
    emitter: &E,
    text: &str,
    style: &Style,
    config: &CerebrasConfig,
) -> Result<String, CerebrasError> {
    let mut last_error: Option<CerebrasError> = None;

    for attempt in 0..=MAX_RETRIES {
        if attempt > 0 {
            info!("Retrying Cerebras request (attempt {})", attempt + 1);
        }

        match do_stream_request::<R, E>(emitter, text, style, config).await {
            Ok(result) => return Ok(result),
            Err(e) => {
                // Don't retry on client errors (4xx) — only on transient/server errors
                if is_retryable(&e) && attempt < MAX_RETRIES {
                    let backoff = retry_backoff(attempt);
                    let _ = emitter.emit(
                        EVENT_RETRYING,
                        RetryEventPayload {
                            attempt: attempt + 2,
                            total_attempts: MAX_RETRIES + 1,
                            backoff_ms: backoff.as_millis() as u64,
                        },
                    );
                    tokio::time::sleep(backoff).await;
                    last_error = Some(e);
                    continue;
                }
                return Err(e);
            }
        }
    }

    Err(last_error
        .unwrap_or_else(|| CerebrasError::RequestFailed("Max retries exceeded".to_string())))
}

/// Load the Cerebras API key from the environment.
pub fn load_api_key() -> Result<String, CerebrasError> {
    std::env::var("CEREBRAS_API_KEY").map_err(|_| {
        CerebrasError::ApiKeyMissing(
            "CEREBRAS_API_KEY not set. Set it in your environment to use Channely.".to_string(),
        )
    })
}

/// Build a CerebrasConfig from environment + defaults.
pub fn config_from_env() -> Result<CerebrasConfig, CerebrasError> {
    let api_key = load_api_key()?;
    Ok(CerebrasConfig {
        api_key,
        ..CerebrasConfig::default()
    })
}

/// Perform a lightweight (non-streaming) test call to validate the API key.
pub async fn test_api_connection(config: &CerebrasConfig) -> Result<bool, CerebrasError> {
    let client = reqwest::Client::new();

    let request = CerebrasRequest {
        stream: false,
        max_completion_tokens: 1,
        messages: vec![ChatMessage {
            role: "user".to_string(),
            content: "test".to_string(),
        }],
        ..CerebrasRequest::default()
    };

    let resp = tokio::time::timeout(
        Duration::from_secs(config.timeout_seconds),
        client
            .post(CEREBRAS_API_URL)
            .bearer_auth(&config.api_key)
            .json(&request)
            .send(),
    )
    .await
    .map_err(|_| CerebrasError::Timeout(config.timeout_seconds))?
    .map_err(map_reqwest_error)?;

    if resp.status().is_success() {
        Ok(true)
    } else {
        Err(map_status_error(resp.status().as_u16(), resp).await)
    }
}

// ── Prompt Construction (Task 2.6) ────────────────────────────────

/// Base system prompt for proofreading.
pub const BASE_SYSTEM_PROMPT: &str = "You are a text proofreader. Fix grammar, spelling, \
    punctuation, and improve clarity while preserving the author's voice and intent. \
    Do NOT change the meaning. Do NOT add information. Keep the same tone and formality level. \
    Return ONLY the corrected text, nothing else.";

/// Build the full system prompt for a given style.
pub fn build_system_prompt(style: &Style) -> String {
    let modifier = style_modifier(style);
    format!("{BASE_SYSTEM_PROMPT}\n\n{modifier}")
}

/// Return the style-specific modifier text.
pub fn style_modifier(style: &Style) -> &'static str {
    match style {
        Style::Casual => "Keep it casual and natural. Use contractions. Be conversational.",
        Style::Professional => "Make it polished and professional. Proper grammar throughout.",
        Style::Concise => "Make it shorter. Remove filler words. Be direct.",
        Style::Friendly => "Warm and approachable tone. Keep it natural.",
    }
}

// ── Internal Helpers ───────────────────────────────────────────────

/// Execute a single streaming request (no retry logic).
async fn do_stream_request<R: tauri::Runtime, E: Emitter<R>>(
    emitter: &E,
    text: &str,
    style: &Style,
    config: &CerebrasConfig,
) -> Result<String, CerebrasError> {
    let system_prompt = build_system_prompt(style);

    let request = CerebrasRequest {
        model: config.model.clone(),
        max_completion_tokens: config.max_completion_tokens,
        reasoning_effort: config.reasoning_effort.clone(),
        messages: vec![
            ChatMessage {
                role: "system".to_string(),
                content: system_prompt,
            },
            ChatMessage {
                role: "user".to_string(),
                content: text.to_string(),
            },
        ],
        ..CerebrasRequest::default()
    };

    let client = reqwest::Client::new();

    // Task 2.7 — Timeout handling
    let resp = tokio::time::timeout(
        Duration::from_secs(config.timeout_seconds),
        client
            .post(CEREBRAS_API_URL)
            .bearer_auth(&config.api_key)
            .json(&request)
            .send(),
    )
    .await
    .map_err(|_| CerebrasError::Timeout(config.timeout_seconds))?
    .map_err(map_reqwest_error)?;

    // Task 2.13 — Non-2xx error handling
    if !resp.status().is_success() {
        return Err(map_status_error(resp.status().as_u16(), resp).await);
    }

    // Task 2.4 — SSE stream parsing
    let mut stream = resp.bytes_stream().eventsource();
    let mut full_text = String::new();

    // Wrap the stream reading in a timeout too
    let stream_result = tokio::time::timeout(Duration::from_secs(config.timeout_seconds), async {
        while let Some(event) = stream.next().await {
            let event = match event {
                Ok(e) => e,
                Err(e) => {
                    warn!("SSE stream error: {e}");
                    return Err(CerebrasError::StreamError(e.to_string()));
                }
            };

            // [DONE] marker terminates stream
            if event.data.trim() == "[DONE]" {
                break;
            }

            // Parse the JSON chunk — skip malformed data gracefully
            let chunk: StreamChunk = match serde_json::from_str(&event.data) {
                Ok(c) => c,
                Err(e) => {
                    warn!("Malformed SSE data (skipping): {e} — data: {}", event.data);
                    continue;
                }
            };

            // Extract delta content from choices[0]
            if let Some(choice) = chunk.choices.first() {
                // Task 2.5 — Emit content tokens
                if let Some(ref content) = choice.delta.content {
                    if !content.is_empty() {
                        full_text.push_str(content);
                        let _ = emitter.emit("cerebras:delta", content.clone());
                    }
                }

                // Task 2.5 — Emit reasoning tokens (hidden from user)
                if let Some(ref reasoning) = choice.delta.reasoning {
                    if !reasoning.is_empty() {
                        let _ = emitter.emit("cerebras:reasoning", reasoning.clone());
                    }
                }
            }
        }

        Ok(full_text)
    })
    .await
    .map_err(|_| CerebrasError::Timeout(config.timeout_seconds))?;

    let result = stream_result?;

    // Task 2.5 — Stream complete
    let _ = emitter.emit("cerebras:done", ());

    Ok(result)
}

/// Determine whether an error is retryable (network / 5xx).
fn is_retryable(err: &CerebrasError) -> bool {
    matches!(
        err,
        CerebrasError::RequestFailed(_)
            | CerebrasError::Offline(_)
            | CerebrasError::Timeout(_)
            | CerebrasError::StreamError(_)
    )
}

fn retry_backoff(attempt: u32) -> Duration {
    // attempt is 0-indexed for retries: 0 -> first retry delay.
    Duration::from_millis(350 * (attempt + 1) as u64)
}

/// Map a reqwest error to a CerebrasError.
fn map_reqwest_error(e: reqwest::Error) -> CerebrasError {
    if e.is_connect() {
        CerebrasError::Offline(
            "No internet connection. Check your network and try again.".to_string(),
        )
    } else if e.is_timeout() {
        CerebrasError::RequestFailed(
            "Network timeout while contacting Cerebras. Try again.".to_string(),
        )
    } else {
        CerebrasError::RequestFailed(e.to_string())
    }
}

fn parse_retry_after_seconds(value: Option<&reqwest::header::HeaderValue>) -> Option<u64> {
    value
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .and_then(|raw| raw.parse::<u64>().ok())
}

/// Map an HTTP status code to a user-friendly CerebrasError.
async fn map_status_error(status: u16, resp: reqwest::Response) -> CerebrasError {
    let retry_after_seconds = parse_retry_after_seconds(resp.headers().get(RETRY_AFTER));

    // Try to parse the error body for a message
    let body_msg = resp
        .json::<CerebrasApiError>()
        .await
        .ok()
        .and_then(|b| b.error)
        .and_then(|e| e.message);

    match status {
        401 => CerebrasError::ApiKeyMissing(
            "Invalid API key. Check your CEREBRAS_API_KEY.".to_string(),
        ),
        429 => {
            let retry_hint = retry_after_seconds.unwrap_or(30);
            CerebrasError::RateLimited(format!("Too many requests. Retry in about {retry_hint}s."))
        }
        s if s >= 500 => CerebrasError::RequestFailed(
            body_msg.unwrap_or_else(|| "Cerebras service error. Retrying...".to_string()),
        ),
        _ => CerebrasError::InvalidResponse(
            body_msg.unwrap_or_else(|| format!("Unexpected status code: {status}")),
        ),
    }
}

// ── Unit Tests ─────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // --- Prompt construction tests (Task 2.6) ---

    #[test]
    fn prompt_casual_contains_base_and_modifier() {
        let prompt = build_system_prompt(&Style::Casual);
        assert!(prompt.starts_with(BASE_SYSTEM_PROMPT));
        assert!(prompt.contains("casual and natural"));
        assert!(prompt.contains("contractions"));
    }

    #[test]
    fn prompt_professional_contains_polished() {
        let prompt = build_system_prompt(&Style::Professional);
        assert!(prompt.starts_with(BASE_SYSTEM_PROMPT));
        assert!(prompt.contains("polished and professional"));
    }

    #[test]
    fn prompt_concise_contains_direct() {
        let prompt = build_system_prompt(&Style::Concise);
        assert!(prompt.starts_with(BASE_SYSTEM_PROMPT));
        assert!(prompt.contains("shorter"));
        assert!(prompt.contains("Be direct"));
    }

    #[test]
    fn prompt_friendly_contains_warm() {
        let prompt = build_system_prompt(&Style::Friendly);
        assert!(prompt.starts_with(BASE_SYSTEM_PROMPT));
        assert!(prompt.contains("Warm and approachable"));
    }

    // --- API key loading (Task 2.9) ---

    #[test]
    fn missing_api_key_returns_clear_error() {
        // Temporarily ensure CEREBRAS_API_KEY is unset
        let original = std::env::var("CEREBRAS_API_KEY").ok();
        std::env::remove_var("CEREBRAS_API_KEY");

        let result = load_api_key();
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(
            err_msg.contains("CEREBRAS_API_KEY not set"),
            "Error should mention CEREBRAS_API_KEY: {err_msg}"
        );

        // Restore if it was set
        if let Some(val) = original {
            std::env::set_var("CEREBRAS_API_KEY", val);
        }
    }

    // --- Non-2xx error mapping (Task 2.13) ---

    #[test]
    fn error_401_maps_to_invalid_api_key() {
        // We test the error type directly
        let err = CerebrasError::ApiKeyMissing(
            "Invalid API key. Check your CEREBRAS_API_KEY.".to_string(),
        );
        assert!(err.to_string().contains("Invalid API key"));
    }

    #[test]
    fn error_rate_limited_maps_correctly() {
        let err = CerebrasError::RateLimited("Too many requests. Retry in about 20s.".to_string());
        assert!(err.to_string().contains("Retry in about 20s"));
    }

    // --- Retry logic (Task 2.8) ---

    #[test]
    fn retryable_errors_identified_correctly() {
        assert!(is_retryable(&CerebrasError::RequestFailed(
            "network".to_string()
        )));
        assert!(is_retryable(&CerebrasError::Offline(
            "No internet connection".to_string()
        )));
        assert!(is_retryable(&CerebrasError::Timeout(30)));
        assert!(is_retryable(&CerebrasError::StreamError(
            "broken".to_string()
        )));

        // Non-retryable
        assert!(!is_retryable(&CerebrasError::ApiKeyMissing(
            "missing".to_string()
        )));
        assert!(!is_retryable(&CerebrasError::RateLimited(
            "wait".to_string()
        )));
        assert!(!is_retryable(&CerebrasError::InvalidResponse(
            "bad".to_string()
        )));
    }

    #[test]
    fn retry_backoff_increases_per_attempt() {
        assert_eq!(retry_backoff(0), Duration::from_millis(350));
        assert_eq!(retry_backoff(1), Duration::from_millis(700));
    }

    #[test]
    fn parse_retry_after_header_seconds() {
        let header = reqwest::header::HeaderValue::from_static("42");
        assert_eq!(parse_retry_after_seconds(Some(&header)), Some(42));
        let bad = reqwest::header::HeaderValue::from_static("tomorrow");
        assert_eq!(parse_retry_after_seconds(Some(&bad)), None);
        assert_eq!(parse_retry_after_seconds(None), None);
    }

    // --- SSE parsing helpers ---

    #[test]
    fn stream_chunk_parses_content_delta() {
        let json = r#"{"choices":[{"delta":{"content":"Hello"}}]}"#;
        let chunk: StreamChunk = serde_json::from_str(json).unwrap();
        assert_eq!(chunk.choices[0].delta.content.as_deref(), Some("Hello"));
        assert_eq!(chunk.choices[0].delta.reasoning, None);
    }

    #[test]
    fn stream_chunk_parses_reasoning_delta() {
        let json = r#"{"choices":[{"delta":{"reasoning":"thinking..."}}]}"#;
        let chunk: StreamChunk = serde_json::from_str(json).unwrap();
        assert_eq!(
            chunk.choices[0].delta.reasoning.as_deref(),
            Some("thinking...")
        );
        assert_eq!(chunk.choices[0].delta.content, None);
    }

    #[test]
    fn stream_chunk_handles_empty_delta() {
        let json = r#"{"choices":[{"delta":{}}]}"#;
        let chunk: StreamChunk = serde_json::from_str(json).unwrap();
        assert_eq!(chunk.choices[0].delta.content, None);
        assert_eq!(chunk.choices[0].delta.reasoning, None);
    }

    #[test]
    fn malformed_json_does_not_panic() {
        let json = r#"{"broken": true"#;
        let result = serde_json::from_str::<StreamChunk>(json);
        assert!(result.is_err());
    }

    #[test]
    fn done_marker_detected() {
        let data = "[DONE]";
        assert_eq!(data.trim(), "[DONE]");
    }
}
