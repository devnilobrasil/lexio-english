/// Endpoint OpenAI-compatible do Gemini (Auth: Bearer {key})
pub const AI_BASE_URL: &str =
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

/// Modelo free tier: 15 RPM, 1500 RPD
pub const AI_MODEL: &str = "gemini-2.0-flash";
