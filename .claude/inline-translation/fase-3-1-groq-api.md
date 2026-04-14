# Fase 3.1 — GROQ como Fallback de AI

## Contexto

O Gemini retorna 503 Service Unavailable durante picos de demanda, bloqueando `suggestion_request` e `get_word`. O objetivo é adicionar GROQ (`llama-3.3-70b-versatile`) como provedor de fallback automático — sem exposição ao usuário, sem alterar o fluxo de chamada. Gemini continua sendo a primeira opção; GROQ assume quando Gemini falha (503) ou quando o usuário não configurou uma chave Gemini.

**Modelo de negócio:**
1. Há chave Gemini → tenta Gemini primeiro
   - 503 → tenta GROQ (se chave GROQ existir)
   - Outros erros → propaga erro
2. Sem chave Gemini, há chave GROQ → usa GROQ diretamente
3. Sem nenhuma chave → erro claro ao usuário

---

## Arquivos a modificar

| Arquivo | O que muda |
|---|---|
| `src/tauri/src/ai_client/config.rs` | Adiciona constantes GROQ ao lado das Gemini |
| `src/tauri/src/ai_client/mod.rs` | Extrai `call_provider` interno; adiciona lógica de fallback; ajusta assinatura das funções públicas |
| `src/tauri/src/db/settings.rs` | Adiciona `get_groq_api_key` / `set_groq_api_key` |
| `src/tauri/src/commands/words.rs` | Lê chave GROQ do DB; passa ambas para `fetch_word` |
| `src/tauri/src/commands/suggestion.rs` | Lê chave GROQ do DB; passa ambas para `fetch_translation` |
| `src/tauri/src/main.rs` | Registra `get_groq_api_key` e `set_groq_api_key` no `invoke_handler` |
| `src/renderer/components/SettingsView.tsx` | Adiciona segundo campo de input para chave GROQ |

---

## Plano de implementação

### Passo 1 — `config.rs`: adicionar constantes GROQ

```rust
// Gemini (primary)
pub const GEMINI_BASE_URL: &str =
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
pub const GEMINI_MODEL: &str = "gemini-2.5-flash";

// GROQ (fallback)
pub const GROQ_BASE_URL: &str = "https://api.groq.com/openai/v1/chat/completions";
pub const GROQ_MODEL: &str = "llama-3.3-70b-versatile";
```

Renomear `AI_BASE_URL`→`GEMINI_BASE_URL` e `AI_MODEL`→`GEMINI_MODEL` em todo `ai_client/`.

---

### Passo 2 — `settings.rs`: adicionar chave GROQ

Adicionar ao final do arquivo, seguindo o padrão exato de `get_api_key`/`set_api_key`:

```rust
pub fn get_groq_api_key(conn: &Connection) -> Result<Option<String>> {
    get_setting(conn, "groq_api_key")
}

pub fn set_groq_api_key(conn: &Connection, key: &str) -> Result<()> {
    set_setting(conn, "groq_api_key", key)
}
```

A chave Gemini continua em `"api_key"` (retrocompatibilidade — usuários existentes não perdem a chave).

---

### Passo 3 — `ai_client/mod.rs`: refatorar com fallback

**3a. Função interna `call_provider`** (privada, não exportada):

```rust
async fn call_provider(
    client: &Client,
    base_url: &str,
    model: &str,
    api_key: &str,
    messages: Vec<ChatMessage>,
    json_mode: bool,
) -> Result<String, String>
```

Contém a lógica HTTP atual (construção do `ChatRequest`, envio, leitura do body). Retorna o conteúdo da resposta como `String`.

**3b. Helper `is_503(err: &str) -> bool`** (privado):

```rust
fn is_503(err: &str) -> bool {
    err.contains("503")
}
```

Detecta 503 a partir do erro formatado (`"Gemini API error 503: ..."` ou `"Gemini translation error 503: ..."`).

**3c. Funções públicas com fallback**:

Alterar assinatura de `fetch_word` e `fetch_translation` para receber `groq_api_key: Option<&str>`:

```rust
pub async fn fetch_word(
    client: &Client,
    api_key: &str,         // chave Gemini (vazia → pula Gemini)
    groq_key: Option<&str>,
    word: &str,
    locale: &str,
) -> Result<AIWordResponse, String>
```

Lógica interna:

```rust
// 1. Tenta Gemini se há chave
if !api_key.is_empty() {
    match call_provider(client, GEMINI_BASE_URL, GEMINI_MODEL, api_key, messages.clone(), true).await {
        Ok(content) => return parse_word_response(&content),
        Err(e) if is_503(&e) => { /* fallthrough */ }
        Err(e) => return Err(e),
    }
}

// 2. Tenta GROQ se há chave
if let Some(groq) = groq_key.filter(|k| !k.is_empty()) {
    return call_provider(client, GROQ_BASE_URL, GROQ_MODEL, groq, messages, true)
        .await
        .and_then(|c| parse_word_response(&c));
}

// 3. Nenhuma chave disponível
Err("Nenhuma chave de API configurada. Configure Gemini ou GROQ em Configurações.".to_string())
```

Idem para `fetch_translation`.

**3d. Remover** a asserção `assert!(AI_MODEL.contains("gemini"), ...)` e substituir pelo teste `is_503_detects_gemini_word_error`.

---

### Passo 4 — `commands/words.rs`: ler chave GROQ

No comando `get_word`, após ler a chave Gemini, ler também a GROQ:

```rust
let groq_key = {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_settings::get_groq_api_key(&conn).map_err(|e| e.to_string())?
};

ai_client::fetch_word(&state.http, &api_key, groq_key.as_deref(), word, &locale).await
```

Adicionar IPC commands:

```rust
#[tauri::command]
pub fn get_groq_api_key(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_settings::get_groq_api_key(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_groq_api_key(key: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_settings::set_groq_api_key(&conn, &key).map_err(|e| e.to_string())
}
```

---

### Passo 5 — `commands/suggestion.rs`: ler chave GROQ

Mesma mudança que `words.rs`: ler `groq_key` do DB antes de chamar `fetch_translation`.

---

### Passo 6 — `main.rs`: registrar novos commands

```rust
get_groq_api_key,
set_groq_api_key,
```

---

### Passo 7 — `SettingsView.tsx`: segundo campo

```typescript
const [groqKey, setGroqKey] = useState('')

useEffect(() => {
  invoke<string | null>('get_groq_api_key').then((k) => { if (k) setGroqKey(k) })
}, [])

// No handleSave, adicionar:
await invoke('set_groq_api_key', { key: groqKey.trim() })
```

UI: dois campos separados com labels "Gemini API Key (principal)" e "GROQ API Key (fallback)".

---

## Testes unitários (novos)

| Teste | Arquivo | O que verifica |
|---|---|---|
| `is_503_detects_gemini_word_error` | `ai_client/mod.rs` | `"Gemini API error 503: ..."` → true |
| `is_503_detects_gemini_translate_error` | `ai_client/mod.rs` | `"Gemini translation error 503: ..."` → true |
| `is_503_ignores_other_errors` | `ai_client/mod.rs` | `"Gemini API error 401: ..."` → false |
| `get_groq_api_key_returns_none_when_unset` | `settings.rs` | DB sem chave → None |
| `set_and_get_groq_api_key_roundtrip` | `settings.rs` | Persiste e recupera corretamente |

---

## Verificação end-to-end

```bash
cd src/tauri
cargo test        # todos os testes existentes + 5 novos

cd ../..
npm run build:renderer   # zero erros TypeScript
```

**Teste manual:**
1. App aberto → Configurações → preencher só "GROQ API Key" → Salvar
2. Selecionar texto em PT → overlay traduz via GROQ
3. Preencher ambas → Gemini é usado normalmente
4. DevTools overlay: `await window.__TAURI_INTERNALS__.invoke('suggestion_request')` → retorna tradução

---

## Notas

- O `"api_key"` existente no SQLite **não é renomeado** → retrocompatibilidade garantida
- Ambos os providers usam formato OpenAI-compatible → `call_provider` é idêntico, só muda URL e model
- `SettingsView.tsx` tem ~70 linhas hoje; com o segundo campo vai para ~105 (dentro dos 150)
