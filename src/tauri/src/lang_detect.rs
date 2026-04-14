// src/tauri/src/lang_detect.rs
//
// Cheap stopword-based heuristic to detect whether text is likely English.
// No external API calls — pure string analysis.

const EN_STOPWORDS: &[&str] = &[
    "the", "a", "an", "and", "or", "but", "is", "are", "was", "were",
    "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "will", "would", "could", "should", "may", "might", "to", "of",
    "in", "on", "at", "by", "for", "with", "about", "from",
    "i", "you", "he", "she", "it", "we", "they",
    "this", "that", "these", "those",
    "my", "your", "his", "her", "our", "their",
    "not", "no", "if", "so", "as", "up", "out", "then", "than",
];

const PT_ES_STOPWORDS: &[&str] = &[
    // Portuguese
    "o", "os", "as", "um", "uma", "uns", "umas",
    "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas",
    "por", "para", "com", "que", "se", "mais",
    "é", "são", "foi", "era", "eram", "ser", "ter", "fazer",
    "eu", "você", "ele", "ela", "nós", "eles", "elas",
    "meu", "minha", "seu", "sua", "nosso",
    "não", "também", "mas", "ou", "quando", "como",
    // Spanish
    "el", "los", "las", "un", "unos", "unas",
    "del", "al", "en", "con", "por", "para", "pero",
    "es", "son", "fue", "era", "eran", "ser", "estar", "tener",
    "yo", "tú", "él", "ella", "nosotros", "ellos",
    "mi", "tu", "su", "nuestro",
    "no", "también", "y", "o", "cuando", "como",
];

/// Returns `true` if the text appears to be predominantly English.
/// Uses a cheap stopword heuristic — no API calls.
///
/// Conservative threshold: only blocks the suggestion if there's clear
/// evidence of English. When in doubt (short text, mixed language),
/// returns `false` to show the icon.
pub fn is_likely_english(text: &str) -> bool {
    let words: Vec<String> = text
        .split_whitespace()
        .map(|w| {
            w.chars()
                .filter(|c| c.is_alphabetic())
                .collect::<String>()
                .to_lowercase()
        })
        .filter(|w| !w.is_empty())
        .collect();

    // Too short → inconclusive → don't block (show icon)
    if words.len() < 4 {
        return false;
    }

    let en_hits = words.iter()
        .filter(|w| EN_STOPWORDS.contains(&w.as_str()))
        .count();

    let pt_es_hits = words.iter()
        .filter(|w| PT_ES_STOPWORDS.contains(&w.as_str()))
        .count();

    // Assume English only if:
    // 1. More EN stopwords than PT/ES
    // 2. EN ratio > 20% of words
    let ratio = en_hits as f32 / words.len() as f32;
    en_hits > pt_es_hits && ratio > 0.20
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn english_sentence_returns_true() {
        assert!(is_likely_english("The cat is on the table and it is very happy"));
    }

    #[test]
    fn portuguese_sentence_returns_false() {
        assert!(!is_likely_english("O gato está em cima da mesa e ele está feliz"));
    }

    #[test]
    fn spanish_sentence_returns_false() {
        assert!(!is_likely_english("El gato está en la mesa y él está muy feliz"));
    }

    #[test]
    fn very_short_text_returns_false() {
        assert!(!is_likely_english("the cat"));
    }

    #[test]
    fn english_with_accents_detected() {
        assert!(is_likely_english("I love the naïve café culture in this city"));
    }

    #[test]
    fn empty_string_returns_false() {
        assert!(!is_likely_english(""));
    }

    #[test]
    fn whitespace_only_returns_false() {
        assert!(!is_likely_english("   \n\t  "));
    }

    #[test]
    fn mixed_code_switch_documented_edge_case() {
        // "I need to melhorar meu English" — accepts any result, edge case.
        // This test documents the behavior, does not impose a result.
        let _result = is_likely_english("I need to melhorar meu English para trabalhar");
        // No assert — just ensures it doesn't panic
    }
}
