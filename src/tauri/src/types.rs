use serde::{Deserialize, Serialize};

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
