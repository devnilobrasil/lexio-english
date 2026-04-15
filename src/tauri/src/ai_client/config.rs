/// Endpoint OpenAI-compatible do Gemini (Auth: Bearer {key})
pub const GEMINI_BASE_URL: &str =
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

/// Gemini 2.5 Flash — rápido, com melhor raciocínio que o 2.0.
/// Fallback se der 404: "gemini-2.0-flash-lite" ou "gemini-1.5-flash"
pub const GEMINI_MODEL: &str = "gemini-2.5-flash";

/// Endpoint OpenAI-compatible do GROQ (Auth: Bearer {key})
pub const GROQ_BASE_URL: &str = "https://api.groq.com/openai/v1/chat/completions";

/// GPT-OSS 20B via GROQ (1000 T/sec — fastest production model)
pub const GROQ_MODEL: &str = "openai/gpt-oss-20b";

/// Endpoint OpenAI-compatible do Ollama (local) (Auth: Bearer {key} or empty)
pub const OLLAMA_BASE_URL_DEFAULT: &str = "http://localhost:11434/v1/chat/completions";

/// Default model para Ollama — Gemma 4 26B
pub const OLLAMA_MODEL_DEFAULT: &str = "gemma4:26b";
