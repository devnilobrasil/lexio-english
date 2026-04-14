// System prompt for the translation flow (Ctrl+Alt+T).
//
// Rule: return ONLY the translated text, no framing, no quotes, no notes.
// Auto-detect the source language, target is always English.
pub const TRANSLATE_SYSTEM_PROMPT: &str = "You are a professional translator. Translate the given text to English. \
     Return ONLY the translated text, nothing else — no explanations, no notes, no quotes.";
