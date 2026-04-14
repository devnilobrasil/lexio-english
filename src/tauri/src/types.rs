use serde::{Deserialize, Serialize};
use std::time::Instant;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WordExample {
    pub en: String,
    pub translation: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VerbForms {
    pub infinitive: String,
    pub past: String,
    pub past_participle: String,
    pub present_participle: String,
    pub third_person: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MeaningEntry {
    pub context: String,
    pub meaning_en: String,
    pub meaning_short: String,
    pub meaning: String,
    pub examples: Vec<WordExample>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Word {
    pub id: Option<i64>,
    pub word: String,
    pub phonetic: Option<String>,
    pub pos: Option<String>,
    pub level: Option<String>,
    pub verb_forms: Option<VerbForms>,
    pub meanings: Vec<MeaningEntry>,
    pub synonyms: Vec<String>,
    pub antonyms: Vec<String>,
    pub contexts: Vec<String>,
    pub created_at: Option<String>,
    pub last_viewed: Option<String>,
    pub view_count: Option<i64>,
    pub is_saved: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AIWordResponse {
    pub word: String,
    pub phonetic: Option<String>,
    pub pos: Option<String>,
    pub level: Option<String>,
    pub verb_forms: Option<VerbForms>,
    pub meanings: Vec<MeaningEntry>,
    pub synonyms: Vec<String>,
    pub antonyms: Vec<String>,
    pub contexts: Vec<String>,
}

/// Text selected by the user, captured by the selection_watcher.
/// Lives in AppState between detection and the bubble click.
/// `captured_at`, `cursor_x`, `cursor_y` are read in Phase 4 (dialog placement).
#[allow(dead_code)]
pub struct PendingSuggestion {
    pub original_text: String,
    pub captured_at: Instant,
    pub cursor_x: i32,
    pub cursor_y: i32,
}

/// Payload for the overlay:text-selected event sent to the frontend.
#[derive(Serialize, Clone)]
pub struct TextSelectedPayload {
    pub text: String,
    pub x: i32,
    pub y: i32,
}

/// Response from the suggestion_request command (Phase 3).
#[derive(Serialize, Deserialize)]
pub struct SuggestionResponse {
    pub original: String,
    pub translation: String,
}
