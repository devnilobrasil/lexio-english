pub mod config;
pub mod word_prompt;

use crate::ai_client::config::{AI_BASE_URL, AI_MODEL};
use crate::ai_client::word_prompt::{build_user_prompt, SYSTEM_PROMPT};
use crate::types::AIWordResponse;
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    response_format: ResponseFormat,
}

#[derive(Serialize)]
struct ResponseFormat {
    #[serde(rename = "type")]
    format_type: String,
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

pub async fn fetch_word(
    client: &Client,
    api_key: &str,
    word: &str,
    locale: &str,
) -> Result<AIWordResponse, String> {
    let request = ChatRequest {
        model: AI_MODEL.to_string(),
        messages: vec![
            ChatMessage {
                role: "system".to_string(),
                content: SYSTEM_PROMPT.to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: build_user_prompt(word, locale),
            },
        ],
        response_format: ResponseFormat {
            format_type: "json_object".to_string(),
        },
    };

    let response = client
        .post(AI_BASE_URL)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("HTTP error: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Gemini API error {}: {}", status, body));
    }

    let chat: ChatResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let content = chat
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .ok_or("Empty response from Gemini")?;

    serde_json::from_str::<AIWordResponse>(&content)
        .map_err(|e| format!("Failed to parse AI response JSON: {}", e))
}

#[cfg(test)]
mod tests {
    use crate::ai_client::config::AI_MODEL;
    use crate::ai_client::word_prompt::{build_user_prompt, locale_name};

    #[test]
    fn test_model_is_gemini() {
        assert!(
            AI_MODEL.contains("gemini"),
            "AI_MODEL must be Gemini, not GROQ"
        );
    }

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
