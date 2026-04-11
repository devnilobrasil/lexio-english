/// Endpoint OpenAI-compatible do Gemini (Auth: Bearer {key})
pub const AI_BASE_URL: &str =
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

/// Gemini 2.5 Flash — rápido, com melhor raciocínio que o 2.0.
/// Fallback se der 404: "gemini-2.0-flash-lite" ou "gemini-1.5-flash"
pub const AI_MODEL: &str = "gemini-2.5-flash";
