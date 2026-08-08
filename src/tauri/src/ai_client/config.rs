use std::env;

/// Base URL default for Free Dictionary word endpoint.
pub const FREEDICT_WORD_API_URL_DEFAULT: &str = "https://freedictionaryapi.com/api/v1";
/// Base URL default for Wiktionary definition endpoint.
pub const WIKTIONARY_WORD_API_URL_DEFAULT: &str = "https://en.wiktionary.org/api/rest_v1/page/definition";

/// Base URL default placeholder for Lexio API v2 Translate endpoint.
pub const LEXIO_TRANSLATE_API_URL_DEFAULT: &str = "https://api.lexio.app/v2/translate";

/// Returns the configured URL for Free Dictionary lookup.
pub fn freedict_word_api_url() -> String {
    env::var("LEXIO_WORD_API_URL").unwrap_or_else(|_| FREEDICT_WORD_API_URL_DEFAULT.to_string())
}

/// Returns the configured URL for Wiktionary lookup.
pub fn wiktionary_word_api_url() -> String {
    env::var("LEXIO_WIKTIONARY_API_URL").unwrap_or_else(|_| WIKTIONARY_WORD_API_URL_DEFAULT.to_string())
}

/// Returns the configured URL for translation (reads LEXIO_TRANSLATE_API_URL or defaults).
pub fn translate_api_url() -> String {
    env::var("LEXIO_TRANSLATE_API_URL").unwrap_or_else(|_| LEXIO_TRANSLATE_API_URL_DEFAULT.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_freedict_word_api_url_default() {
        env::remove_var("LEXIO_WORD_API_URL");
        assert_eq!(freedict_word_api_url(), FREEDICT_WORD_API_URL_DEFAULT);
    }

    #[test]
    fn test_wiktionary_word_api_url_default() {
        env::remove_var("LEXIO_WIKTIONARY_API_URL");
        assert_eq!(wiktionary_word_api_url(), WIKTIONARY_WORD_API_URL_DEFAULT);
    }

    #[test]
    fn test_translate_api_url_default() {
        env::remove_var("LEXIO_TRANSLATE_API_URL");
        assert_eq!(translate_api_url(), LEXIO_TRANSLATE_API_URL_DEFAULT);
    }
}
