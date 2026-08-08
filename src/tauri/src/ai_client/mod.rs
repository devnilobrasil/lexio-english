pub mod config;

use crate::types::{AIWordResponse, MeaningEntry, WordExample};
use reqwest::{Client, RequestBuilder, Url};
use serde::Deserialize;
use std::collections::{BTreeSet, HashMap};

const WIKIMEDIA_USER_AGENT: &str = "Lexio/1.5 (https://github.com/devnilobrasil/lexio)";

#[derive(Deserialize, Debug, Clone)]
struct FreeDictLanguage {
    #[allow(dead_code)]
    code: String,
    #[allow(dead_code)]
    name: String,
}

#[derive(Deserialize, Debug, Clone)]
struct FreeDictPronunciation {
    #[serde(rename = "type")]
    r#type: String,
    text: String,
}

#[derive(Deserialize, Debug, Clone)]
struct FreeDictForm {
    #[allow(dead_code)]
    word: String,
    #[allow(dead_code)]
    tags: Option<Vec<String>>,
}

#[derive(Deserialize, Debug, Clone)]
struct FreeDictQuote {
    text: String,
    reference: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
struct FreeDictSense {
    definition: String,
    tags: Option<Vec<String>>,
    examples: Option<Vec<String>>,
    quotes: Option<Vec<FreeDictQuote>>,
    synonyms: Option<Vec<String>>,
    antonyms: Option<Vec<String>>,
}

#[derive(Deserialize, Debug, Clone)]
struct FreeDictEntry {
    #[allow(dead_code)]
    language: Option<FreeDictLanguage>,
    #[serde(rename = "partOfSpeech")]
    part_of_speech: String,
    pronunciations: Option<Vec<FreeDictPronunciation>>,
    #[allow(dead_code)]
    forms: Option<Vec<FreeDictForm>>,
    senses: Option<Vec<FreeDictSense>>,
    synonyms: Option<Vec<String>>,
    antonyms: Option<Vec<String>>,
}

#[derive(Deserialize, Debug, Clone)]
struct FreeDictResponse {
    word: String,
    entries: Vec<FreeDictEntry>,
}

#[derive(Deserialize, Debug, Clone)]
struct WiktionaryDefinition {
    definition: Option<String>,
    examples: Option<Vec<String>>,
}

#[derive(Deserialize, Debug, Clone)]
struct WiktionaryEntry {
    #[serde(rename = "partOfSpeech")]
    part_of_speech: String,
    definitions: Vec<WiktionaryDefinition>,
}

#[derive(Debug, Clone)]
struct FreeDictMetadata {
    phonetic: Option<String>,
    synonyms: Vec<String>,
    antonyms: Vec<String>,
}

fn clean_html(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut in_tag = false;
    let mut pending_space = false;

    for ch in input.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => {
                if in_tag {
                    in_tag = false;
                    pending_space = true;
                }
            }
            _ if !in_tag => {
                if pending_space && !out.is_empty() && !out.ends_with(char::is_whitespace) {
                    out.push(' ');
                }
                pending_space = false;
                out.push(ch);
            }
            _ => {}
        }
    }

    out = out
        .replace("&nbsp;", " ")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&");

    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn normalize_for_dedupe(input: &str) -> String {
    input
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn push_unique_example(
    examples: &mut Vec<WordExample>,
    seen_example_indexes: &mut HashMap<String, usize>,
    raw_text: &str,
    translation: String,
) {
    let cleaned = clean_html(raw_text);
    if cleaned.is_empty() {
        return;
    }

    let key = normalize_for_dedupe(&cleaned);
    if let Some(existing_index) = seen_example_indexes.get(&key) {
        if examples[*existing_index].translation.is_empty() && !translation.is_empty() {
            examples[*existing_index].translation = translation;
        }
        return;
    }

    seen_example_indexes.insert(key, examples.len());
    examples.push(WordExample {
        en: cleaned,
        translation,
    });
}

fn merge_unique_examples(existing: &mut Vec<WordExample>, incoming: Vec<WordExample>) {
    let mut seen_example_indexes = existing
        .iter()
        .enumerate()
        .map(|(index, example)| (normalize_for_dedupe(&example.en), index))
        .collect::<HashMap<_, _>>();

    for example in incoming {
        let key = normalize_for_dedupe(&example.en);
        if let Some(existing_index) = seen_example_indexes.get(&key) {
            if existing[*existing_index].translation.is_empty() && !example.translation.is_empty() {
                existing[*existing_index].translation = example.translation;
            }
            continue;
        }

        seen_example_indexes.insert(key, existing.len());
        existing.push(WordExample {
            en: example.en,
            translation: example.translation,
        });
    }
}

fn map_wiktionary_to_ai_word(
    word: &str,
    response: HashMap<String, Vec<WiktionaryEntry>>,
) -> Result<AIWordResponse, String> {
    let en_entries = response
        .get("en")
        .ok_or_else(|| "Wiktionary response does not contain 'en' definitions".to_string())?;

    let mut pos_set = BTreeSet::new();
    let mut contexts_set = BTreeSet::new();
    let mut meanings: Vec<MeaningEntry> = Vec::new();
    let mut meaning_indexes: HashMap<(String, String), usize> = HashMap::new();

    for entry in en_entries {
        if entry.part_of_speech.trim().is_empty() {
            continue;
        }

        pos_set.insert(entry.part_of_speech.clone());
        contexts_set.insert(entry.part_of_speech.clone());

        for definition in &entry.definitions {
            let Some(raw_definition) = definition.definition.as_ref() else {
                continue;
            };

            let cleaned_definition = clean_html(raw_definition);
            if cleaned_definition.is_empty() {
                continue;
            }

            let mut examples = Vec::new();
            let mut seen_example_indexes = HashMap::new();
            if let Some(example_list) = definition.examples.as_ref() {
                for example in example_list {
                    push_unique_example(
                        &mut examples,
                        &mut seen_example_indexes,
                        example,
                        String::new(),
                    );
                }
            }

            let meaning_key = (
                normalize_for_dedupe(&entry.part_of_speech),
                normalize_for_dedupe(&cleaned_definition),
            );
            if let Some(existing_index) = meaning_indexes.get(&meaning_key) {
                merge_unique_examples(&mut meanings[*existing_index].examples, examples);
                continue;
            }
            meaning_indexes.insert(meaning_key, meanings.len());

            meanings.push(MeaningEntry {
                context: entry.part_of_speech.clone(),
                meaning_en: cleaned_definition.clone(),
                meaning_short: cleaned_definition.clone(),
                meaning: cleaned_definition,
                examples,
            });
        }
    }

    if meanings.is_empty() {
        return Err("Wiktionary response contains no usable definitions".to_string());
    }

    let pos = if pos_set.is_empty() {
        None
    } else {
        Some(pos_set.into_iter().collect::<Vec<_>>().join(", "))
    };

    Ok(AIWordResponse {
        word: word.to_string(),
        phonetic: None,
        pos,
        level: None,
        verb_forms: None,
        meanings,
        synonyms: Vec::new(),
        antonyms: Vec::new(),
        contexts: contexts_set.into_iter().collect(),
    })
}

fn map_freedict_to_ai_word(response: FreeDictResponse) -> Result<AIWordResponse, String> {
    if response.entries.is_empty() {
        return Err("Free Dictionary response has no entries".to_string());
    }

    let mut phonetic = None;
    for entry in &response.entries {
        if let Some(ref prons) = entry.pronunciations {
            for pron in prons {
                if pron.r#type == "ipa" {
                    phonetic = Some(pron.text.clone());
                    break;
                }
            }
        }
        if phonetic.is_some() {
            break;
        }
    }

    let mut pos_set = BTreeSet::new();
    for entry in &response.entries {
        pos_set.insert(entry.part_of_speech.clone());
    }
    let pos = if pos_set.is_empty() {
        None
    } else {
        Some(pos_set.into_iter().collect::<Vec<_>>().join(", "))
    };

    let mut meanings: Vec<MeaningEntry> = Vec::new();
    let mut meaning_indexes: HashMap<(String, String), usize> = HashMap::new();
    let mut synonyms_set = BTreeSet::new();
    let mut antonyms_set = BTreeSet::new();
    let mut contexts_set = BTreeSet::new();

    for entry in &response.entries {
        contexts_set.insert(entry.part_of_speech.clone());
        if let Some(ref syns) = entry.synonyms {
            for s in syns {
                synonyms_set.insert(s.clone());
            }
        }
        if let Some(ref ants) = entry.antonyms {
            for a in ants {
                antonyms_set.insert(a.clone());
            }
        }

        if let Some(ref senses) = entry.senses {
            for sense in senses {
                let cleaned_definition = clean_html(&sense.definition);
                if cleaned_definition.is_empty() {
                    continue;
                }

                let mut word_examples = Vec::new();
                let mut seen_example_indexes = HashMap::new();
                if let Some(ref examples) = sense.examples {
                    for ex in examples {
                        push_unique_example(
                            &mut word_examples,
                            &mut seen_example_indexes,
                            ex,
                            String::new(),
                        );
                    }
                }
                // Caso nao haja examples, coloque a chave quotes - text
                if word_examples.is_empty() {
                    if let Some(ref quotes) = sense.quotes {
                        for q in quotes {
                            push_unique_example(
                                &mut word_examples,
                                &mut seen_example_indexes,
                                &q.text,
                                q.reference.clone().unwrap_or_default(),
                            );
                        }
                    }
                }

                let mut context = entry.part_of_speech.clone();
                if let Some(ref tags) = sense.tags {
                    for t in tags {
                        contexts_set.insert(t.clone());
                    }
                    if !tags.is_empty() {
                        context = format!("{} ({})", context, tags.join(", "));
                    }
                }

                if let Some(ref syns) = sense.synonyms {
                    for s in syns {
                        synonyms_set.insert(s.clone());
                    }
                }
                if let Some(ref ants) = sense.antonyms {
                    for a in ants {
                        antonyms_set.insert(a.clone());
                    }
                }

                let meaning_key = (
                    normalize_for_dedupe(&context),
                    normalize_for_dedupe(&cleaned_definition),
                );
                if let Some(existing_index) = meaning_indexes.get(&meaning_key) {
                    merge_unique_examples(&mut meanings[*existing_index].examples, word_examples);
                    continue;
                }
                meaning_indexes.insert(meaning_key, meanings.len());

                meanings.push(MeaningEntry {
                    context,
                    meaning_en: cleaned_definition.clone(),
                    meaning_short: cleaned_definition.clone(),
                    meaning: cleaned_definition,
                    examples: word_examples,
                });
            }
        }
    }

    if meanings.is_empty() {
        return Err("Free Dictionary response has no usable meanings".to_string());
    }

    Ok(AIWordResponse {
        word: response.word,
        phonetic,
        pos,
        level: None,
        verb_forms: None,
        meanings,
        synonyms: synonyms_set.into_iter().collect(),
        antonyms: antonyms_set.into_iter().collect(),
        contexts: contexts_set.into_iter().collect(),
    })
}

fn map_freedict_metadata(response: &FreeDictResponse) -> FreeDictMetadata {
    let mut phonetic = None;
    let mut synonyms = BTreeSet::new();
    let mut antonyms = BTreeSet::new();

    for entry in &response.entries {
        if phonetic.is_none() {
            if let Some(ref prons) = entry.pronunciations {
                for pron in prons {
                    if pron.r#type == "ipa" {
                        phonetic = Some(pron.text.clone());
                        break;
                    }
                }
            }
        }

        if let Some(ref syns) = entry.synonyms {
            for syn in syns {
                synonyms.insert(syn.clone());
            }
        }

        if let Some(ref ants) = entry.antonyms {
            for ant in ants {
                antonyms.insert(ant.clone());
            }
        }

        if let Some(ref senses) = entry.senses {
            for sense in senses {
                if let Some(ref syns) = sense.synonyms {
                    for syn in syns {
                        synonyms.insert(syn.clone());
                    }
                }

                if let Some(ref ants) = sense.antonyms {
                    for ant in ants {
                        antonyms.insert(ant.clone());
                    }
                }
            }
        }
    }

    FreeDictMetadata {
        phonetic,
        synonyms: synonyms.into_iter().collect(),
        antonyms: antonyms.into_iter().collect(),
    }
}

fn merge_wiktionary_with_freedict_metadata(
    mut wiktionary_word: AIWordResponse,
    metadata: FreeDictMetadata,
) -> AIWordResponse {
    wiktionary_word.phonetic = metadata.phonetic;
    wiktionary_word.synonyms = metadata.synonyms;
    wiktionary_word.antonyms = metadata.antonyms;
    wiktionary_word
}

async fn fetch_wiktionary_word(client: &Client, word: &str) -> Result<AIWordResponse, String> {
    let base_url = config::wiktionary_word_api_url();
    let mut url = Url::parse(&base_url)
        .map_err(|e| format!("Invalid Wiktionary base URL '{}': {}", base_url, e))?;
    url.path_segments_mut()
        .map_err(|_| "Wiktionary base URL cannot be used for path segments".to_string())?
        .push(word);

    let response = client
        .get(url)
        .header(reqwest::header::USER_AGENT, WIKIMEDIA_USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("Wiktionary HTTP error: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Wiktionary API error {}: {}", status, body));
    }

    let parsed = response
        .json::<HashMap<String, Vec<WiktionaryEntry>>>()
        .await
        .map_err(|e| format!("Failed to parse Wiktionary response JSON: {}", e))?;

    map_wiktionary_to_ai_word(word, parsed)
}

async fn fetch_freedict_word(client: &Client, word: &str) -> Result<FreeDictResponse, String> {
    let base_url = config::freedict_word_api_url();
    let mut url = Url::parse(&base_url)
        .map_err(|e| format!("Invalid Free Dictionary base URL '{}': {}", base_url, e))?;
    url.path_segments_mut()
        .map_err(|_| "Free Dictionary base URL cannot be used for path segments".to_string())?
        .extend(["entries", "en", word]);
    {
        let mut query_pairs = url.query_pairs_mut();
        query_pairs.append_pair("translations", "false");
        query_pairs.append_pair("pretty", "true");
    }

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Free Dictionary HTTP error: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Free Dictionary API error {}: {}", status, body));
    }

    response
        .json::<FreeDictResponse>()
        .await
        .map_err(|e| format!("Failed to parse Free Dictionary API response JSON: {}", e))
}

#[derive(Deserialize)]
struct TranslationApiResponse {
    translation: Option<String>,
}

fn with_api_key(request: RequestBuilder, api_key: Option<&str>) -> RequestBuilder {
    match api_key.map(str::trim).filter(|key| !key.is_empty()) {
        Some(key) => request.bearer_auth(key),
        None => request,
    }
}

/// Fetches word data from Wiktionary with Free Dictionary fallback/enrichment.
pub async fn fetch_word(
    client: &Client,
    word: &str,
    _locale: &str,
) -> Result<AIWordResponse, String> {
    let (wiktionary_result, freedict_result) = tokio::join!(
        fetch_wiktionary_word(client, word),
        fetch_freedict_word(client, word)
    );

    match (wiktionary_result, freedict_result) {
        (Ok(wiktionary_word), Ok(freedict_response)) => Ok(merge_wiktionary_with_freedict_metadata(
            wiktionary_word,
            map_freedict_metadata(&freedict_response),
        )),
        (Ok(wiktionary_word), Err(_)) => Ok(wiktionary_word),
        (Err(_), Ok(freedict_response)) => map_freedict_to_ai_word(freedict_response),
        (Err(wiktionary_err), Err(freedict_err)) => Err(format!(
            "Word lookup failed. Wiktionary: {} | Free Dictionary: {}",
            wiktionary_err, freedict_err
        )),
    }
}

/// Translates `text` using the Lexio API v2 translation endpoint.
pub async fn fetch_translation(
    client: &Client,
    api_key: Option<&str>,
    text: &str,
) -> Result<String, String> {
    let url = config::translate_api_url();
    let body = serde_json::json!({ "text": text });
    let response = with_api_key(client.post(&url), api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("HTTP error: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("API v2 translation error {}: {}", status, body));
    }

    let text_resp = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    if let Ok(parsed) = serde_json::from_str::<TranslationApiResponse>(&text_resp) {
        if let Some(t) = parsed.translation {
            return Ok(t.trim().to_string());
        }
    }

    Ok(text_resp.trim().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn translation_request_uses_stored_api_key_as_bearer_token() {
        let request = with_api_key(
            Client::new().post("https://api.lexio.app/v2/translate"),
            Some("  stored-key  "),
        )
        .build()
        .unwrap();

        assert_eq!(
            request
                .headers()
                .get(reqwest::header::AUTHORIZATION)
                .unwrap(),
            "Bearer stored-key"
        );
    }

    #[test]
    fn translation_request_omits_auth_header_without_api_key() {
        let request = with_api_key(
            Client::new().post("https://api.lexio.app/v2/translate"),
            None,
        )
        .build()
        .unwrap();

        assert!(request
            .headers()
            .get(reqwest::header::AUTHORIZATION)
            .is_none());
    }

    #[test]
    fn test_parse_translation_response_json() {
        let json = r#"{ "translation": "The cat sat on the mat." }"#;
        let parsed: Result<TranslationApiResponse, _> = serde_json::from_str(json);
        assert!(parsed.is_ok());
        assert_eq!(parsed.unwrap().translation.unwrap(), "The cat sat on the mat.");
    }

    #[test]
    fn test_map_freedict_to_ai_word_from_example() {
        let json = r#"{
          "word": "explanation",
          "entries": [
            {
              "language": {
                "code": "en",
                "name": "English"
              },
              "partOfSpeech": "noun",
              "pronunciations": [
                {
                  "type": "ipa",
                  "text": "/ˌɛkspləˈneɪʃən/",
                  "tags": []
                }
              ],
              "forms": [
                {
                  "word": "explanations",
                  "tags": ["plural"]
                }
              ],
              "senses": [
                {
                  "definition": "The act or process of explaining.",
                  "tags": ["countable", "uncountable"],
                  "examples": [
                    "The explanation was long and drawn-out."
                  ],
                  "quotes": [],
                  "synonyms": [],
                  "antonyms": [],
                  "subsenses": []
                },
                {
                  "definition": "Something that explains or makes understandable.",
                  "tags": ["countable"],
                  "examples": [],
                  "quotes": [
                    {
                      "text": "The socialist will, of course...",
                      "reference": "1949, F. A. Hayek..."
                    }
                  ],
                  "synonyms": [],
                  "antonyms": [],
                  "subsenses": []
                }
              ],
              "synonyms": [
                "clarification",
                "elucidation"
              ],
              "antonyms": []
            }
          ]
        }"#;

        let parsed: FreeDictResponse = serde_json::from_str(json).unwrap();
        let mapped = map_freedict_to_ai_word(parsed).unwrap();

        assert_eq!(mapped.word, "explanation");
        assert_eq!(mapped.phonetic.unwrap(), "/ˌɛkspləˈneɪʃən/");
        assert_eq!(mapped.pos.unwrap(), "noun");

        // Count senses/meanings
        assert_eq!(mapped.meanings.len(), 2);

        // Check sense 1 (with example)
        let m1 = &mapped.meanings[0];
        assert_eq!(m1.context, "noun (countable, uncountable)");
        assert_eq!(m1.meaning_en, "The act or process of explaining.");
        assert_eq!(m1.examples.len(), 1);
        assert_eq!(m1.examples[0].en, "The explanation was long and drawn-out.");
        assert_eq!(m1.examples[0].translation, "");

        // Check sense 2 (no example, should fall back to quotes)
        let m2 = &mapped.meanings[1];
        assert_eq!(m2.context, "noun (countable)");
        assert_eq!(m2.examples.len(), 1);
        assert_eq!(m2.examples[0].en, "The socialist will, of course...");
        assert_eq!(m2.examples[0].translation, "1949, F. A. Hayek...");

        // Check synonyms
        assert!(mapped.synonyms.contains(&"clarification".to_string()));
        assert!(mapped.synonyms.contains(&"elucidation".to_string()));
    }

    #[test]
    fn test_clean_html_removes_tags_and_nbsp() {
        let raw = "<b>cat</b>&nbsp;<i>animal</i>";
        assert_eq!(clean_html(raw), "cat animal");
    }

    #[test]
    fn test_clean_html_keeps_word_boundary_between_adjacent_tags() {
        let raw = "<b>A</b><i>trial</i>";
        assert_eq!(clean_html(raw), "A trial");
    }

    #[test]
    fn test_clean_html_decodes_common_entities() {
        let raw = "&nbsp;A&amp;B &quot;quoted&quot; &#39;single&#39; &lt;tag&gt;&nbsp;";
        assert_eq!(clean_html(raw), "A&B \"quoted\" 'single' <tag>");
    }

    #[test]
    fn test_push_unique_example_dedupes_after_cleaning_html() {
        let mut examples = Vec::new();
        let mut seen = HashMap::new();

        push_unique_example(&mut examples, &mut seen, "<b>A</b><i>trial</i>", String::new());
        push_unique_example(&mut examples, &mut seen, "A trial", String::new());

        assert_eq!(examples.len(), 1);
        assert_eq!(examples[0].en, "A trial");
    }

    #[test]
    fn test_map_wiktionary_to_ai_word_from_example() {
        let json = r#"{
          "en": [
            {
              "partOfSpeech": "noun",
              "definitions": [
                {
                  "definition": "<b>A domesticated</b>&nbsp;feline mammal.",
                  "examples": ["<i>The</i> cat sleeps."]
                }
              ]
            }
          ]
        }"#;

        let parsed: HashMap<String, Vec<WiktionaryEntry>> = serde_json::from_str(json).unwrap();
        let mapped = map_wiktionary_to_ai_word("cat", parsed).unwrap();

        assert_eq!(mapped.word, "cat");
        assert_eq!(mapped.pos, Some("noun".to_string()));
        assert_eq!(mapped.meanings.len(), 1);
        assert_eq!(mapped.meanings[0].meaning_en, "A domesticated feline mammal.");
        assert_eq!(mapped.meanings[0].examples[0].en, "The cat sleeps.");
    }

    #[test]
    fn test_map_wiktionary_deduplicates_meanings_and_examples() {
        let json = r#"{
          "en": [
            {
              "partOfSpeech": "noun",
              "definitions": [
                {
                  "definition": "A domesticated feline mammal.",
                  "examples": ["The cat sleeps.", " The cat   sleeps. "]
                },
                {
                  "definition": "  A domesticated feline mammal.  ",
                  "examples": ["  The cat sleeps. "]
                }
              ]
            }
          ]
        }"#;

        let parsed: HashMap<String, Vec<WiktionaryEntry>> = serde_json::from_str(json).unwrap();
        let mapped = map_wiktionary_to_ai_word("cat", parsed).unwrap();

        assert_eq!(mapped.meanings.len(), 1);
        assert_eq!(mapped.meanings[0].examples.len(), 1);
        assert_eq!(mapped.meanings[0].examples[0].en, "The cat sleeps.");
    }

    #[test]
    fn test_merge_wiktionary_meanings_with_freedict_metadata() {
        let wiki = AIWordResponse {
            word: "cat".to_string(),
            phonetic: None,
            pos: Some("noun".to_string()),
            level: None,
            verb_forms: None,
            meanings: vec![crate::types::MeaningEntry {
                context: "noun".to_string(),
                meaning_en: "A feline mammal.".to_string(),
                meaning_short: "A feline mammal.".to_string(),
                meaning: "A feline mammal.".to_string(),
                examples: vec![],
            }],
            synonyms: vec![],
            antonyms: vec![],
            contexts: vec!["noun".to_string()],
        };

        let merged = merge_wiktionary_with_freedict_metadata(
            wiki,
            FreeDictMetadata {
                phonetic: Some("/kæt/".to_string()),
                synonyms: vec!["kitty".to_string()],
                antonyms: vec!["dog".to_string()],
            },
        );

        assert_eq!(merged.phonetic, Some("/kæt/".to_string()));
        assert_eq!(merged.synonyms, vec!["kitty".to_string()]);
        assert_eq!(merged.antonyms, vec!["dog".to_string()]);
        assert_eq!(merged.meanings[0].meaning, "A feline mammal.");
    }

    #[test]
    fn test_map_freedict_to_ai_word_rejects_empty_entries() {
        let parsed: FreeDictResponse = serde_json::from_str(r#"{ "word": "cat", "entries": [] }"#).unwrap();
        let result = map_freedict_to_ai_word(parsed);
        assert!(result.is_err());
    }

    #[test]
    fn test_map_freedict_deduplicates_meanings_and_examples() {
        let json = r#"{
          "word": "test",
          "entries": [
            {
              "partOfSpeech": "noun",
              "senses": [
                {
                  "definition": "A trial.",
                  "tags": [],
                  "examples": ["This is a test.", " This   is a test. "],
                  "quotes": [],
                  "synonyms": [],
                  "antonyms": []
                },
                {
                  "definition": "  A trial. ",
                  "tags": [],
                  "examples": [" This is a test. "],
                  "quotes": [],
                  "synonyms": [],
                  "antonyms": []
                }
              ]
            }
          ]
        }"#;

        let parsed: FreeDictResponse = serde_json::from_str(json).unwrap();
        let mapped = map_freedict_to_ai_word(parsed).unwrap();

        assert_eq!(mapped.meanings.len(), 1);
        assert_eq!(mapped.meanings[0].examples.len(), 1);
        assert_eq!(mapped.meanings[0].examples[0].en, "This is a test.");
    }

    #[test]
    fn test_map_wiktionary_merges_examples_for_duplicate_meaning() {
        let json = r#"{
          "en": [
            {
              "partOfSpeech": "noun",
              "definitions": [
                {
                  "definition": "A domesticated feline mammal.",
                  "examples": []
                },
                {
                  "definition": " A domesticated feline mammal. ",
                  "examples": ["The cat sleeps."]
                }
              ]
            }
          ]
        }"#;

        let parsed: HashMap<String, Vec<WiktionaryEntry>> = serde_json::from_str(json).unwrap();
        let mapped = map_wiktionary_to_ai_word("cat", parsed).unwrap();

        assert_eq!(mapped.meanings.len(), 1);
        assert_eq!(mapped.meanings[0].examples.len(), 1);
        assert_eq!(mapped.meanings[0].examples[0].en, "The cat sleeps.");
    }

    #[test]
    fn test_map_freedict_cleans_and_dedupes_duplicate_examples() {
        let json = r#"{
          "word": "test",
          "entries": [
            {
              "partOfSpeech": "noun",
              "senses": [
                {
                  "definition": "A trial.",
                  "tags": [],
                  "examples": ["<b>  This   is&nbsp;a test. </b>", "This is a test."],
                  "quotes": [],
                  "synonyms": [],
                  "antonyms": []
                }
              ]
            }
          ]
        }"#;

        let parsed: FreeDictResponse = serde_json::from_str(json).unwrap();
        let mapped = map_freedict_to_ai_word(parsed).unwrap();

        assert_eq!(mapped.meanings.len(), 1);
        assert_eq!(mapped.meanings[0].examples.len(), 1);
        assert_eq!(mapped.meanings[0].examples[0].en, "This is a test.");
    }

    #[test]
    fn test_map_wiktionary_preserves_order_while_merging_examples() {
        let json = r#"{
          "en": [
            {
              "partOfSpeech": "noun",
              "definitions": [
                {
                  "definition": "First meaning.",
                  "examples": ["First example."]
                },
                {
                  "definition": "Second meaning.",
                  "examples": ["Second meaning example."]
                },
                {
                  "definition": " First meaning. ",
                  "examples": ["Second example for first meaning."]
                }
              ]
            }
          ]
        }"#;

        let parsed: HashMap<String, Vec<WiktionaryEntry>> = serde_json::from_str(json).unwrap();
        let mapped = map_wiktionary_to_ai_word("test", parsed).unwrap();

        assert_eq!(mapped.meanings.len(), 2);
        assert_eq!(mapped.meanings[0].meaning_en, "First meaning.");
        assert_eq!(mapped.meanings[1].meaning_en, "Second meaning.");
        assert_eq!(mapped.meanings[0].examples.len(), 2);
        assert_eq!(mapped.meanings[0].examples[0].en, "First example.");
        assert_eq!(
            mapped.meanings[0].examples[1].en,
            "Second example for first meaning."
        );
    }

    #[test]
    fn test_merge_unique_examples_preserves_richer_duplicate_translation() {
        let mut existing = vec![WordExample {
            en: "The cat sleeps.".to_string(),
            translation: String::new(),
        }];
        let incoming = vec![WordExample {
            en: "  The   cat sleeps. ".to_string(),
            translation: "Fonte: exemplo".to_string(),
        }];

        merge_unique_examples(&mut existing, incoming);

        assert_eq!(existing.len(), 1);
        assert_eq!(existing[0].en, "The cat sleeps.");
        assert_eq!(existing[0].translation, "Fonte: exemplo");
    }

    #[test]
    fn test_map_wiktionary_meaning_key_avoids_delimiter_collisions() {
        let json = r#"{
          "en": [
            {
              "partOfSpeech": "noun|verb",
              "definitions": [
                {
                  "definition": "primary",
                  "examples": ["First example."]
                }
              ]
            },
            {
              "partOfSpeech": "noun",
              "definitions": [
                {
                  "definition": "verb|primary",
                  "examples": ["Second example."]
                }
              ]
            }
          ]
        }"#;

        let parsed: HashMap<String, Vec<WiktionaryEntry>> = serde_json::from_str(json).unwrap();
        let mapped = map_wiktionary_to_ai_word("test", parsed).unwrap();

        assert_eq!(mapped.meanings.len(), 2);
        assert_eq!(mapped.meanings[0].examples[0].en, "First example.");
        assert_eq!(mapped.meanings[1].examples[0].en, "Second example.");
    }

    #[test]
    fn test_map_freedict_cleans_definition_before_storage_and_dedupe() {
        let json = r#"{
          "word": "test",
          "entries": [
            {
              "partOfSpeech": "noun",
              "senses": [
                {
                  "definition": "<b>A&nbsp;trial.</b>",
                  "tags": [],
                  "examples": ["First example."],
                  "quotes": [],
                  "synonyms": [],
                  "antonyms": []
                },
                {
                  "definition": " A trial. ",
                  "tags": [],
                  "examples": ["Second example."],
                  "quotes": [],
                  "synonyms": [],
                  "antonyms": []
                }
              ]
            }
          ]
        }"#;

        let parsed: FreeDictResponse = serde_json::from_str(json).unwrap();
        let mapped = map_freedict_to_ai_word(parsed).unwrap();

        assert_eq!(mapped.meanings.len(), 1);
        assert_eq!(mapped.meanings[0].meaning_en, "A trial.");
        assert_eq!(mapped.meanings[0].meaning_short, "A trial.");
        assert_eq!(mapped.meanings[0].meaning, "A trial.");
        assert_eq!(mapped.meanings[0].examples.len(), 2);
        assert_eq!(mapped.meanings[0].examples[0].en, "First example.");
        assert_eq!(mapped.meanings[0].examples[1].en, "Second example.");
    }

    #[test]
    fn test_word_url_encoding_special_characters() {
        let mut wiki_url = Url::parse(config::WIKTIONARY_WORD_API_URL_DEFAULT).unwrap();
        wiki_url
            .path_segments_mut()
            .unwrap()
            .push("c# sharp / test?");
        let encoded = wiki_url.to_string();
        assert!(encoded.contains("c%23%20sharp%20%2F%20test%3F"));
    }
}
