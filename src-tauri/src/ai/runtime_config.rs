use tauri::{AppHandle, Manager, Runtime};

use crate::config::ConfigState;

use super::types::{CerebrasConfig, CerebrasError};

fn resolve_api_key(
    configured_api_key: Option<&str>,
    env_api_key: Option<String>,
) -> Result<String, CerebrasError> {
    if let Some(key) = configured_api_key.map(str::trim).filter(|k| !k.is_empty()) {
        return Ok(key.to_string());
    }

    if let Some(key) = env_api_key
        .map(|k| k.trim().to_string())
        .filter(|k| !k.is_empty())
    {
        return Ok(key);
    }

    Err(CerebrasError::ApiKeyMissing(
        "Cerebras API key is not configured. Add it in onboarding/settings or set CEREBRAS_API_KEY."
            .to_string(),
    ))
}

pub fn config_from_state_or_env<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<CerebrasConfig, CerebrasError> {
    let mut config = CerebrasConfig::default();
    let mut configured_api_key: Option<String> = None;

    if let Some(state) = app.try_state::<ConfigState>() {
        let app_config = state
            .0
            .lock()
            .map_err(|e| CerebrasError::RequestFailed(format!("Failed to lock config: {e}")))?;

        config.model = app_config.ai.model.clone();
        config.reasoning_effort = app_config.ai.reasoning_effort.clone();
        config.max_completion_tokens = app_config.ai.max_completion_tokens;
        config.timeout_seconds = app_config.ai.timeout_seconds;

        if !app_config.ai.api_key.trim().is_empty() {
            configured_api_key = Some(app_config.ai.api_key.clone());
        }
    }

    config.api_key = resolve_api_key(
        configured_api_key.as_deref(),
        std::env::var("CEREBRAS_API_KEY").ok(),
    )?;

    Ok(config)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn configured_key_wins_over_env() {
        let key =
            resolve_api_key(Some("csk-configured"), Some("csk-from-env".to_string())).unwrap();
        assert_eq!(key, "csk-configured");
    }

    #[test]
    fn env_key_used_when_config_missing() {
        let key = resolve_api_key(None, Some("csk-from-env".to_string())).unwrap();
        assert_eq!(key, "csk-from-env");
    }

    #[test]
    fn missing_key_returns_clear_error() {
        let err = resolve_api_key(None, None).unwrap_err();
        assert!(err.to_string().contains("not configured"));
    }
}
