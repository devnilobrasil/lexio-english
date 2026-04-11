pub const SYSTEM_PROMPT: &str = r#"You are an expert English lexicographer and language teacher specialized in helping non-native speakers truly understand and retain English vocabulary.

Your responses must follow these quality standards:
- Phonetic transcription must be accurate IPA notation
- Meanings must be clear, natural, and written as a native speaker of the target language would explain it — not a literal translation
- Examples must be real-world, practical sentences that reflect how the word is actually used today — avoid generic or overly simple sentences
- For verbs, at least one example must show the word in a natural conversational or professional context
- Synonyms must be genuinely interchangeable in at least one common context
- Level assessment: Basic (A1-A2), Intermediate (B1-B2), Advanced (C1-C2), Technical (domain-specific jargon)
- Respond ONLY with valid JSON, no markdown, no extra text, no explanations"#;

pub fn locale_name(locale: &str) -> &'static str {
    match locale {
        "pt-BR" => "Brazilian Portuguese",
        "es" => "Spanish",
        _ => "English",
    }
}

pub fn locale_instructions(locale: &str) -> &'static str {
    match locale {
        "pt-BR" => r#"- The "meaning" field inside each meanings entry must be written in natural Brazilian Portuguese, as a Brazilian would explain it to a friend — not a dictionary translation
- "meaning_short" must be a faithful word-for-word translation of "meaning_en" into Brazilian Portuguese — translate the exact same content, do not summarize
- "translation" in examples must sound natural in Brazilian Portuguese, not word-for-word
- Use Brazilian vocabulary and expressions, not European Portuguese"#,
        "es" => r#"- The "meaning" field inside each meanings entry must be written in natural Spanish, as a native speaker would explain it to a friend
- "meaning_short" must be a faithful word-for-word translation of "meaning_en" into Spanish — translate the exact same content, do not summarize
- "translation" in examples must sound natural in Spanish, not word-for-word"#,
        _ => "",
    }
}

pub fn build_user_prompt(word: &str, locale: &str) -> String {
    let locale_name = locale_name(locale);
    let locale_instructions = locale_instructions(locale);
    format!(
        r#"For the English word "{word}", return exactly this JSON structure with no deviations:

{{
  "word": "{word}",
  "phonetic": "accurate IPA transcription",
  "pos": "one of: verb | noun | adjective | adverb | phrase | idiom | conjunction | preposition",
  "verb_forms": {{
    "infinitive": "to {word}",
    "past": "past tense form",
    "past_participle": "past participle form",
    "present_participle": "present participle form",
    "third_person": "third person singular present"
  }},
  "level": "one of: Basic | Intermediate | Advanced | Technical",
  "meanings": [
    {{
      "context": "Brief context tag (e.g., General, Business, Computing, Slang, Phrasal Verb, Sports)",
      "meaning_en": "concise English definition in plain language, 1 sentence max",
      "meaning_short": "faithful word-for-word translation of meaning_en into {locale_name} — translate the exact same content, do not summarize",
      "meaning": "clear and natural explanation in {locale_name} — explain it like a knowledgeable friend would",
      "examples": [
        {{
          "en": "natural, real-world sentence showing this specific meaning in context",
          "translation": "natural translation in {locale_name}"
        }}
      ]
    }}
  ],
  "synonyms": ["3 to 5 genuinely interchangeable synonyms in common contexts"],
  "antonyms": ["1 to 3 antonyms if applicable, empty array if none"],
  "contexts": ["1 to 3 contexts where this word is most commonly used"]
}}

Critical rules for "meanings":
- You MUST return between 2 and 5 distinct meanings.
- Each meaning must represent a genuinely different use of the word.
- Each meaning MUST include at least 1 example.
- Examples must be real-world, practical sentences.

Other rules:
- If the word is NOT a verb, set "verb_forms" to null
- "contexts" must be chosen from: Business, Technology, Informal, Formal, Finance, Marketing, HR, Legal, Medicine, Slang, Academic, Literature, Sports, Travel
{locale_instructions}"#
    )
}
