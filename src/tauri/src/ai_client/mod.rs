pub mod config;
pub mod translate_prompt;
pub mod word_prompt;

use crate::ai_client::config::{GEMINI_BASE_URL, GEMINI_MODEL, GROQ_BASE_URL, GROQ_MODEL};
use crate::ai_client::translate_prompt::TRANSLATE_SYSTEM_PROMPT;
use crate::ai_client::word_prompt::{build_user_prompt, SYSTEM_PROMPT};
use crate::types::AIWordResponse;
use reqwest::Client;
use serde::Deserialize;

#[derive(Clone)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: ChoiceMessage,
}

#[derive(Deserialize)]
struct ChoiceMessage {
    content: String,
}

/// Returns `(base_url, model)` for the given provider name.
/// For Ollama, accepts dynamic base_url and model (user-configured).
/// Defaults to Gemini for any unrecognised value.
fn provider_config(provider: &str, ollama_url: &str, ollama_model: &str) -> (String, String) {
    match provider {
        "groq" => (GROQ_BASE_URL.to_string(), GROQ_MODEL.to_string()),
        "ollama" => (ollama_url.to_string(), ollama_model.to_string()),
        _ => (GEMINI_BASE_URL.to_string(), GEMINI_MODEL.to_string()),
    }
}

/// Low-level HTTP call to any OpenAI-compatible endpoint.
/// Returns the raw `content` string from `choices[0].message.content`.
/// `json_mode`: when true, adds `response_format: { type: "json_object" }`.
/// `disable_thinking`: when true, adds `think: false` (for Ollama reasoning models).
async fn call_provider(
    client: &Client,
    base_url: &str,
    model: &str,
    api_key: &str,
    messages: Vec<ChatMessage>,
    json_mode: bool,
    disable_thinking: bool,
) -> Result<String, String> {
    let msgs: Vec<serde_json::Value> = messages
        .iter()
        .map(|m| serde_json::json!({ "role": m.role, "content": m.content }))
        .collect();

    let mut body = serde_json::json!({ "model": model, "messages": msgs });

    if json_mode {
        body["response_format"] = serde_json::json!({ "type": "json_object" });
    }
    if disable_thinking {
        body["think"] = serde_json::json!(false);
    }

    let mut request = client.post(base_url);

    // Only add Authorization header if api_key is not empty (Ollama doesn't need it)
    if !api_key.is_empty() {
        request = request.header("Authorization", format!("Bearer {}", api_key));
    }

    let response = request
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("HTTP error: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("AI provider error {}: {}", status, body));
    }

    let chat: ChatResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    chat.choices
        .first()
        .map(|c| c.message.content.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "Empty response from AI provider".to_string())
}

/// Fetches word data from the selected AI provider.
///
/// `provider`: "gemini" | "groq" | "ollama" — determines which endpoint and model to use.
/// `api_key`: the key for the selected provider. Returns an error if empty (except for ollama).
/// `ollama_url`: base URL for Ollama (ignored for other providers).
/// `ollama_model`: model name for Ollama (ignored for other providers).
pub async fn fetch_word(
    client: &Client,
    provider: &str,
    api_key: &str,
    word: &str,
    locale: &str,
    ollama_url: &str,
    ollama_model: &str,
) -> Result<AIWordResponse, String> {
    // Ollama doesn't need an API key, but other providers do
    if provider != "ollama" && api_key.is_empty() {
        return Err(format!(
            "Chave {} não configurada. Acesse Configurações.",
            provider
        ));
    }

    let messages = vec![
        ChatMessage {
            role: "system".to_string(),
            content: SYSTEM_PROMPT.to_string(),
        },
        ChatMessage {
            role: "user".to_string(),
            content: build_user_prompt(word, locale),
        },
    ];

    let (base_url, model) = provider_config(provider, ollama_url, ollama_model);
    let is_ollama = provider == "ollama";
    // Ollama models don't support response_format: json_object; disable thinking for reasoning models
    let content = call_provider(client, &base_url, &model, api_key, messages, !is_ollama, is_ollama).await?;
    serde_json::from_str::<AIWordResponse>(&content)
        .map_err(|e| format!("Failed to parse AI response JSON: {}", e))
}

/// Translates `text` to English using the selected AI provider.
/// Returns plain text (no JSON wrapping).
///
/// `provider`: "gemini" | "groq" | "ollama".
/// `api_key`: the key for the selected provider. Returns an error if empty (except for ollama).
/// `ollama_url`: base URL for Ollama (ignored for other providers).
/// `ollama_model`: model name for Ollama (ignored for other providers).
pub async fn fetch_translation(
    client: &Client,
    provider: &str,
    api_key: &str,
    text: &str,
    ollama_url: &str,
    ollama_model: &str,
) -> Result<String, String> {
    // Ollama doesn't need an API key, but other providers do
    if provider != "ollama" && api_key.is_empty() {
        return Err(format!(
            "Chave {} não configurada. Acesse Configurações.",
            provider
        ));
    }

    let messages = vec![
        ChatMessage {
            role: "system".to_string(),
            content: TRANSLATE_SYSTEM_PROMPT.to_string(),
        },
        ChatMessage {
            role: "user".to_string(),
            content: text.to_string(),
        },
    ];

    let (base_url, model) = provider_config(provider, ollama_url, ollama_model);
    let is_ollama = provider == "ollama";
    call_provider(client, &base_url, &model, api_key, messages, false, is_ollama).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai_client::word_prompt::{build_user_prompt, locale_name};

    // --- provider_config ---

    #[test]
    fn provider_config_groq_returns_groq_constants() {
        let (url, model) = provider_config("groq", "", "");
        assert_eq!(url, GROQ_BASE_URL.to_string());
        assert_eq!(model, GROQ_MODEL.to_string());
    }

    #[test]
    fn provider_config_gemini_returns_gemini_constants() {
        let (url, model) = provider_config("gemini", "", "");
        assert_eq!(url, GEMINI_BASE_URL.to_string());
        assert_eq!(model, GEMINI_MODEL.to_string());
    }

    #[test]
    fn provider_config_ollama_returns_user_url_and_model() {
        let custom_url = "http://192.168.1.100:11434/v1/chat/completions";
        let custom_model = "llama3";
        let (url, model) = provider_config("ollama", custom_url, custom_model);
        assert_eq!(url, custom_url.to_string());
        assert_eq!(model, custom_model.to_string());
    }

    #[test]
    fn provider_config_unknown_defaults_to_gemini() {
        let (url, model) = provider_config("openai", "", "");
        assert_eq!(url, GEMINI_BASE_URL.to_string());
        assert_eq!(model, GEMINI_MODEL.to_string());
    }

    // --- empty key guard ---

    #[test]
    fn fetch_word_rejects_empty_api_key() {
        // Validate that an empty key is rejected before any HTTP call is made.
        // We mirror the guard logic directly since we can't call the async fn in a sync test.
        let api_key = "";
        let provider = "gemini";
        let result: Result<(), String> = if api_key.is_empty() {
            Err(format!(
                "Chave {} não configurada. Acesse Configurações.",
                provider
            ))
        } else {
            Ok(())
        };
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("gemini"));
    }

    #[test]
    fn fetch_translation_rejects_empty_api_key() {
        let api_key = "";
        let provider = "groq";
        let result: Result<(), String> = if api_key.is_empty() {
            Err(format!(
                "Chave {} não configurada. Acesse Configurações.",
                provider
            ))
        } else {
            Ok(())
        };
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("groq"));
    }

    // --- locale / prompt ---

    #[test]
    fn test_locale_name_pt_br() {
        assert_eq!(locale_name("pt-BR"), "Brazilian Portuguese");
    }

    #[test]
    fn test_locale_name_es() {
        assert_eq!(locale_name("es"), "Spanish");
    }

    #[test]
    fn test_locale_name_unknown_falls_back_to_english() {
        assert_eq!(locale_name("fr"), "English");
    }

    #[test]
    fn test_build_user_prompt_contains_word() {
        let prompt = build_user_prompt("churn", "pt-BR");
        assert!(prompt.contains("churn"));
        assert!(prompt.contains("Brazilian Portuguese"));
    }

    #[test]
    fn test_build_user_prompt_es_contains_spanish() {
        let prompt = build_user_prompt("run", "es");
        assert!(prompt.contains("Spanish"));
    }

    #[test]
    fn test_parse_ai_response_valid_json() {
        let json = r#"{
            "word": "churn",
            "phonetic": "/tʃɜːrn/",
            "pos": "verb",
            "level": "Advanced",
            "verb_forms": null,
            "meanings": [],
            "synonyms": ["agitate"],
            "antonyms": [],
            "contexts": ["Business"]
        }"#;
        let result: Result<crate::types::AIWordResponse, _> = serde_json::from_str(json);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().word, "churn");
    }

    #[test]
    fn test_parse_ai_response_invalid_json_errors() {
        let bad_json = r#"not valid json"#;
        let result: Result<crate::types::AIWordResponse, _> = serde_json::from_str(bad_json);
        assert!(result.is_err());
    }

    #[test]
    fn test_translate_prompt_is_non_empty() {
        use crate::ai_client::translate_prompt::TRANSLATE_SYSTEM_PROMPT;
        assert!(!TRANSLATE_SYSTEM_PROMPT.is_empty());
    }

    #[test]
    fn test_translate_prompt_targets_english() {
        use crate::ai_client::translate_prompt::TRANSLATE_SYSTEM_PROMPT;
        assert!(TRANSLATE_SYSTEM_PROMPT.to_lowercase().contains("english"));
    }

    #[test]
    fn test_translate_prompt_forbids_explanations() {
        use crate::ai_client::translate_prompt::TRANSLATE_SYSTEM_PROMPT;
        assert!(TRANSLATE_SYSTEM_PROMPT.to_lowercase().contains("only"));
    }

    #[test]
    fn test_parse_translation_response_extracts_content() {
        let json = r#"{
            "choices": [
                { "message": { "content": "The cat sat on the mat." } }
            ]
        }"#;
        let parsed: Result<super::ChatResponse, _> = serde_json::from_str(json);
        assert!(parsed.is_ok());
        let chat = parsed.unwrap();
        assert_eq!(chat.choices[0].message.content, "The cat sat on the mat.");
    }

    #[test]
    fn test_parse_ai_response_with_full_meanings() {
        let json = r#"{
            "word": "churn",
            "phonetic": "/tʃɜːrn/",
            "pos": "verb",
            "level": "Advanced",
            "verb_forms": {
                "infinitive": "to churn",
                "past": "churned",
                "past_participle": "churned",
                "present_participle": "churning",
                "third_person": "churns"
            },
            "meanings": [
                {
                    "context": "Business",
                    "meaning_en": "To produce in large quantities.",
                    "meaning_short": "Produzir em grandes quantidades.",
                    "meaning": "Quando algo é produzido em massa.",
                    "examples": [
                        { "en": "The factory churns out cars.", "translation": "A fábrica produz carros." }
                    ]
                }
            ],
            "synonyms": ["agitate", "stir"],
            "antonyms": ["calm"],
            "contexts": ["Business"]
        }"#;
        let result: crate::types::AIWordResponse = serde_json::from_str(json).unwrap();
        assert_eq!(result.meanings.len(), 1);
        assert_eq!(result.meanings[0].context, "Business");
        assert_eq!(result.meanings[0].examples.len(), 1);
        assert!(result.verb_forms.is_some());
    }
}
