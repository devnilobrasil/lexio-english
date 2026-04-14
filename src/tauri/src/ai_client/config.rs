/// Endpoint OpenAI-compatible do Gemini (Auth: Bearer {key})
pub const GEMINI_BASE_URL: &str =
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

/// Gemini 2.5 Flash — rápido, com melhor raciocínio que o 2.0.
/// Fallback se der 404: "gemini-2.0-flash-lite" ou "gemini-1.5-flash"
pub const GEMINI_MODEL: &str = "gemini-2.5-flash";

/// Endpoint OpenAI-compatible do GROQ (Auth: Bearer {key})
pub const GROQ_BASE_URL: &str = "https://api.groq.com/openai/v1/chat/completions";

/// LLaMA 3.3 70B via GROQ
pub const GROQ_MODEL: &str = "llama-3.3-70b-versatile";
