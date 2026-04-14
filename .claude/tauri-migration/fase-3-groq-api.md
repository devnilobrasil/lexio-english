# Fase 3 — Backend Rust: AI Client (Gemini) — Word Lookup

> **GROQ [deprecated]** — `ai.ts` atual chama GROQ no renderer. Esta fase move a integração para Rust usando Gemini 2.0 Flash. Os prompts não mudam; só o endpoint e o modelo.

**Objetivo:** Mover a chamada de AI de busca de palavras do renderer (`ai.ts`) para Rust. O command `get_word` passa a fazer cache miss → Gemini → auto-save em uma única operação. Deletar `ai.ts`. Simplificar `useSearch.ts`.

**Referência:** `SPEC.md` — Seção 6, Seção 11

---

## Skills e Modelo

**Modelo recomendado:** `claude-opus-4-6`
Esta fase tem a mudança arquitetural mais impactante: mover a integração AI do renderer para Rust e deletar `ai.ts`. Requer raciocínio sobre async Rust, deadlocks de Mutex, e o novo contrato IPC do `useSearch`. Usar Opus.

**Ler antes de implementar:**

| Skill | Por quê |
|---|---|
| `.claude/skills/tauri-architecture/SKILL.md` | `async fn` commands, `State<>` injection, regra do MutexGuard antes de `await` |
| `.claude/skills/rust-patterns/SKILL.md` | `reqwest::Client` reutilizável, error propagation, async no Tauri |
| `superpowers:test-driven-development` | Testes de parse de JSON e prompts antes de implementar `fetch_word` |
| `superpowers:systematic-debugging` | Depurar `reqwest`, timeouts, parsing de resposta Gemini |

---

## Pré-requisitos

- Fase 2 concluída (DB funcionando com todos os commands)
- API key sendo salva e lida corretamente via `get_api_key`

---

## Dependências a Adicionar em `Cargo.toml`

```toml
reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }
tokio = { version = "1", features = ["full"] }
```

Adicionar também ao `AppState` em `state.rs`:

```rust
use reqwest::Client;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub http: Client,           // NOVO — reutilizável entre requests
}

impl AppState {
    pub fn new(conn: Connection) -> Self {
        AppState {
            db: Mutex::new(conn),
            http: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("failed to build HTTP client"),
        }
    }
}
```

---

## Estrutura de Arquivos

> O módulo se chama `ai_client/` (agnóstico de provider) para facilitar troca futura na monetização.

```
src/tauri/src/
├── ai_client/
│   ├── mod.rs             ← NOVO: cliente HTTP Gemini + structs de request/response
│   ├── config.rs          ← NOVO: constantes de provider (endpoint, modelo)
│   ├── word_prompt.rs     ← NOVO: system prompt + buildUserPrompt portados de ai.ts
│   └── translate_prompt.rs  ← para Fase 5
└── commands/
    └── words.rs           ← ATUALIZAR: get_word agora é async
```

---

## Passo 1 — Config do Provider (`src/tauri/src/ai_client/config.rs`)

```rust
// Centraliza endpoint e modelo — troca de provider muda só aqui

/// Endpoint OpenAI-compatible do Gemini (Auth: Bearer {key})
pub const AI_BASE_URL: &str =
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

/// Modelo free tier: 15 RPM, 1500 RPD — suficiente para MVP pessoal
pub const AI_MODEL: &str = "gemini-2.0-flash";

// Para monetização futura: trocar a key do usuário por uma key paid
// O modelo e endpoint permanecem iguais; só o rate limit muda com a key.
```

---

## Passo 2 — Prompts (`src/tauri/src/ai_client/word_prompt.rs`)

Portar `ai.ts` exatamente. Os prompts não mudam — apenas o arquivo que os contém:

```rust
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
        "es"    => "Spanish",
        _       => "English",
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
    format!(r#"For the English word "{word}", return exactly this JSON structure with no deviations:

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
{locale_instructions}"#)
}
```

---

## Passo 3 — Cliente Gemini (`src/tauri/src/ai_client/mod.rs`)

O endpoint OpenAI-compatible do Gemini aceita o mesmo payload do GROQ [deprecated] — mudança mínima:

```rust
use reqwest::Client;
use serde::{Deserialize, Serialize};
use crate::types::AIWordResponse;
use crate::ai_client::config::{AI_BASE_URL, AI_MODEL};
use crate::ai_client::word_prompt::{SYSTEM_PROMPT, build_user_prompt};

#[derive(Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    response_format: ResponseFormat,
}

#[derive(Serialize)]
struct ResponseFormat {
    #[serde(rename = "type")]
    format_type: String,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: ChoiceMessage,
}

#[derive(Deserialize)]
struct ChoiceMessage {
    content: String,
}

pub async fn fetch_word(
    client: &Client,
    api_key: &str,
    word: &str,
    locale: &str,
) -> Result<AIWordResponse, String> {
    let request = ChatRequest {
        model: AI_MODEL.to_string(),                    // "gemini-2.0-flash"
        messages: vec![
            ChatMessage { role: "system".to_string(), content: SYSTEM_PROMPT.to_string() },
            ChatMessage { role: "user".to_string(),   content: build_user_prompt(word, locale) },
        ],
        response_format: ResponseFormat { format_type: "json_object".to_string() },
    };

    let response = client
        .post(AI_BASE_URL)                              // endpoint Gemini OpenAI-compat
        .header("Authorization", format!("Bearer {}", api_key))  // mesmo header do GROQ
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("HTTP error: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Gemini API error {}: {}", status, body));
    }

    let chat: ChatResponse = response.json().await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let content = chat.choices.first()
        .map(|c| c.message.content.clone())
        .ok_or("Empty response from Gemini")?;

    serde_json::from_str::<AIWordResponse>(&content)
        .map_err(|e| format!("Failed to parse AI response JSON: {}", e))
}
```

---

## Passo 4 — Command `get_word` (async) (`src/tauri/src/commands/words.rs`)

Adicionar ao arquivo já existente da Fase 2:

```rust
use crate::ai_client;                           // era: use crate::groq [deprecated]
use crate::db::{words as db_words, settings as db_settings};

#[tauri::command]
pub async fn get_word(
    word: String,
    locale: String,
    state: tauri::State<'_, AppState>,
) -> Result<Option<Word>, String> {
    // 1. Tentar cache no SQLite
    let cached = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        db_words::get_word(&conn, &word, &locale).map_err(|e| e.to_string())?
    };

    if cached.is_some() {
        return Ok(cached);
    }

    // 2. Cache miss — buscar API key
    let api_key = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        db_settings::get_api_key(&conn).map_err(|e| e.to_string())?
    };
    let api_key = api_key.ok_or("API key not configured. Please set it in Settings.")?;

    // 3. Chamar Gemini (era: Groq [deprecated])
    let ai_response = ai_client::fetch_word(&state.http, &api_key, &word, &locale).await?;

    // 4. Auto-salvar no SQLite
    let saved = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        db_words::upsert_word(&conn, &ai_response, &locale).map_err(|e| e.to_string())?
    };

    Ok(Some(saved))
}
```

**Nota sobre o Mutex:** O lock é liberado antes de cada `await`. Isso é crítico — nunca segurar um `MutexGuard` através de um `await`, pois deadlock é garantido.

Atualizar `main.rs` para incluir `get_word` no `invoke_handler`:
```rust
commands::words::get_word,   // adicionar — é async
```

---

## Passo 5 — Testes (`src/tauri/src/ai_client/tests.rs`)

```rust
#[cfg(test)]
mod tests {
    use crate::ai_client::word_prompt::{build_user_prompt, locale_name};
    use crate::ai_client::config::AI_MODEL;

    #[test]
    fn test_model_is_gemini() {
        assert!(AI_MODEL.contains("gemini"), "AI_MODEL deve ser Gemini, não GROQ");
    }

    #[test]
    fn test_locale_name_pt_br() {
        assert_eq!(locale_name("pt-BR"), "Brazilian Portuguese");
    }

    #[test]
    fn test_locale_name_es() {
        assert_eq!(locale_name("es"), "Spanish");
    }

    #[test]
    fn test_build_user_prompt_contains_word() {
        let prompt = build_user_prompt("churn", "pt-BR");
        assert!(prompt.contains("churn"));
        assert!(prompt.contains("Brazilian Portuguese"));
    }

    #[test]
    fn test_parse_ai_response_valid_json() {
        let json = r#"{
            "word": "churn",
            "phonetic": "/tʃɜːrn/",
            "pos": "verb",
            "level": "Advanced",
            "verb_forms": null,
            "meanings": [],
            "synonyms": ["agitate"],
            "antonyms": [],
            "contexts": ["Business"]
        }"#;
        let result: Result<crate::types::AIWordResponse, _> = serde_json::from_str(json);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().word, "churn");
    }

    #[test]
    fn test_parse_ai_response_invalid_json_errors() {
        let bad_json = r#"not valid json"#;
        let result: Result<crate::types::AIWordResponse, _> = serde_json::from_str(bad_json);
        assert!(result.is_err());
    }
}
```

Para testar o fluxo completo de `get_word` (cache miss → Gemini → save), criar um teste de integração com `wiremock` ou injetar uma resposta mockada via arquivo JSON em `tests/fixtures/`.

---

## Passo 6 — Deletar `ai.ts` e Atualizar `useSearch.ts`

### Deletar
```
src/renderer/lib/ai.ts       ← DELETAR (chamava GROQ [deprecated])
src/renderer/lib/ai.test.ts  ← DELETAR (os testes de prompt migram para Rust)
```

### Atualizar `src/renderer/hooks/useSearch.ts`

**Antes (Electron — GROQ [deprecated]):**
```ts
// busca no DB → se null, chama GROQ no renderer → salva
const cached = await window.lexio.getWord(word, locale)
if (cached) return cached
const aiResponse = await fetchWordFromGroq(word, locale)   // GROQ [deprecated]
await window.lexio.saveWord(aiResponse, locale)
```

**Depois (Tauri — Gemini):**
```ts
// get_word faz tudo: DB → Gemini → auto-save
const result = await invoke<Word | null>('get_word', { word, locale })
return result
```

O hook fica significativamente mais simples. Remover todas as importações de `ai.ts`.

---

## Passo 7 — Atualizar CSP (`tauri.conf.json`)

O renderer não faz mais chamadas externas. Remover GROQ [deprecated] do `connect-src`:

```json
"security": {
  "csp": "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"
}
```

Nota: `generativelanguage.googleapis.com` **não precisa** estar no CSP porque as chamadas saem do Rust, não do renderer.

---

## Limite Free Tier Gemini (informativo)

| Limite | Valor | Impacto no Lexio |
|---|---|---|
| Requests por minuto | 15 RPM | Cache SQLite absorve a maioria dos lookups repetidos |
| Requests por dia | 1500 RPD | ~1500 palavras novas/dia — muito mais que uso pessoal real |
| Tokens por minuto | 1M TPM | Sem impacto prático |

Se o rate limit for atingido, a API retorna `429`. Tratar com mensagem clara na UI: "Limite diário atingido. Aguarde até amanhã ou atualize para a versão premium."

---

## Critério de Saída da Fase 3

- [ ] `cargo test` passa (incluindo `test_model_is_gemini`)
- [ ] Busca de palavra com cache hit retorna imediatamente (sem chamada Gemini)
- [ ] Busca de palavra com cache miss chama Gemini, salva, retorna Word completa
- [ ] `ai.ts` deletado — `npm run build:renderer` passa sem erros
- [ ] `useSearch.ts` não importa mais nada de `ai.ts`
- [ ] API key nunca aparece em logs do renderer (DevTools Network tab vazio)
- [ ] CSP limpo — sem domínios de API externos
- [ ] Nenhuma referência a `groq` no código Rust (apenas comentários `[deprecated]` se necessário)
