# Fase 1 — Backend: Detecção de Seleção e Gate de Idioma

**Objetivo:** Criar o motor de detecção passiva — hook global de mouse, captura oportunística de texto, gate de idioma via stopwords, e emissão do evento `overlay:text-selected`. Ao final desta fase, o app detecta automaticamente quando o usuário seleciona texto em qualquer aplicativo e emite o evento, mas o frontend ainda não reage a ele.

**Referência:** `SPEC.md` — Seções 5 (Detecção global), 6 (Detecção de idioma), 4 (AppState), 9 (Backend — arquivos)

---

## Skills e Modelo

**Modelo recomendado:** `claude-opus-4-6`
Esta fase envolve código Rust de baixo nível: thread dedicada com `rdev`, integração nativa com clipboard via `arboard`, lógica de debounce e heurística de idioma. Requer raciocínio cuidadoso sobre lifetimes e ownership entre threads. Usar Opus.

**Ler antes de implementar:**

| Skill | Por quê |
|---|---|
| `.claude/skills/tauri-architecture/SKILL.md` | `emit()` de eventos Rust → frontend, acesso a `AppState`, padrão `Mutex` |
| `.claude/skills/rust-patterns/SKILL.md` | `AppState` com `Mutex`, `thread::spawn`, error handling, `Instant` para debounce |
| `superpowers:using-git-worktrees` | Isolar a feature em branch `feat/inline-translation` sem impactar `stage` |
| `superpowers:test-driven-development` | Escrever testes de `lang_detect.rs` **antes** da implementação |

---

## Pré-requisitos

- Branch `feat/inline-translation` criada a partir de `stage`
- `cargo build` passando no estado atual
- `npm test` passando no estado atual (baseline verde)

---

## Dependências a adicionar em `Cargo.toml`

```toml
rdev = "0.5"
```

**Nota:** `arboard` e `enigo` já estão presentes no projeto (usados por `text_bridge.rs`). Não readicionar.

---

## Estrutura de Arquivos desta Fase

```
src/tauri/src/
├── lang_detect.rs          ← NOVO
├── selection_watcher.rs    ← NOVO
├── state.rs                ← MODIFICAR: adicionar pending_suggestion
├── types.rs                ← MODIFICAR: adicionar PendingSuggestion, TextSelectedPayload
├── shortcuts.rs            ← MODIFICAR: remover Ctrl+Alt+Shift+T (linhas 70-96)
├── commands/
│   └── overlay.rs          ← MODIFICAR: deletar overlay_translate e do_translate
└── main.rs                 ← MODIFICAR: wire do watcher no setup()
```

---

## Passo 0 — Remover o shortcut e commands antigos

**Antes de criar qualquer coisa nova, limpar o código obsoleto.**

### `src/tauri/src/shortcuts.rs` (linhas 70-96)

Remover o bloco inteiro de registro do `Ctrl+Alt+Shift+T`. Manter `Ctrl+Alt+E` e `Ctrl+Alt+O`.

### `src/tauri/src/commands/overlay.rs`

Deletar as funções `overlay_translate` e `do_translate()`. Manter `overlay_drag_start` e `overlay_set_position` — esses continuam funcionando para arrastar o bubble.

Verificar que `commands/mod.rs` não exporta mais `overlay_translate`.

Verificar que `main.rs` não registra mais `overlay_translate` no `invoke_handler!`.

```bash
cargo build  # deve compilar sem erros após as remoções
```

---

## Passo 1 — Novos tipos em `types.rs`

Adicionar ao arquivo existente:

```rust
// src/tauri/src/types.rs

use std::time::Instant;
use serde::{Serialize, Deserialize};

/// Texto selecionado pelo usuário, capturado pelo selection_watcher.
/// Vive no AppState entre a detecção e o clique no bubble.
pub struct PendingSuggestion {
    pub original_text: String,
    pub captured_at: Instant,
    pub cursor_x: i32,
    pub cursor_y: i32,
}

/// Payload do evento overlay:text-selected enviado ao frontend.
#[derive(Serialize, Clone)]
pub struct TextSelectedPayload {
    pub text: String,
    pub x: i32,
    pub y: i32,
}

/// Resposta do command suggestion_request (Fase 3).
#[derive(Serialize, Deserialize)]
pub struct SuggestionResponse {
    pub original: String,
    pub translation: String,
}
```

---

## Passo 2 — Atualizar `AppState` em `state.rs`

```rust
// src/tauri/src/state.rs

use std::sync::Mutex;
use rusqlite::Connection;
use reqwest::Client;
use crate::types::PendingSuggestion;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub http: Client,
    pub pending_suggestion: Mutex<Option<PendingSuggestion>>,
    // ... demais campos existentes, não alterar ...
}

impl AppState {
    pub fn new(conn: Connection) -> Self {
        Self {
            db: Mutex::new(conn),
            http: Client::new(),
            pending_suggestion: Mutex::new(None),
            // ... inicializar demais campos ...
        }
    }
}
```

---

## Passo 3 — `lang_detect.rs` (TDD: testes primeiro)

### 3.1 — Escrever os testes antes da implementação

```rust
// src/tauri/src/lang_detect.rs

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
        // < 4 palavras → não confiante o suficiente → não bloqueia
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
        // "I need to melhorar meu English" — aceita qualquer resultado, é edge case
        // Este teste documenta o comportamento, não impõe um resultado
        let _result = is_likely_english("I need to melhorar meu English para trabalhar");
        // Não tem assert — só garante que não panics
    }
}
```

### 3.2 — Implementar `is_likely_english`

```rust
// src/tauri/src/lang_detect.rs

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
    // Português
    "o", "os", "as", "um", "uma", "uns", "umas",
    "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas",
    "por", "para", "com", "que", "se", "mais",
    "é", "são", "foi", "era", "eram", "ser", "ter", "fazer",
    "eu", "você", "ele", "ela", "nós", "eles", "elas",
    "meu", "minha", "seu", "sua", "nosso",
    "não", "também", "mas", "ou", "quando", "como",
    // Espanhol
    "el", "los", "las", "un", "unos", "unas",
    "del", "al", "en", "con", "por", "para", "pero",
    "es", "son", "fue", "era", "eran", "ser", "estar", "tener",
    "yo", "tú", "él", "ella", "nosotros", "ellos",
    "mi", "tu", "su", "nuestro",
    "no", "también", "y", "o", "cuando", "como",
];

/// Retorna `true` se o texto parece ser predominantemente inglês.
/// Usa heurística barata de stopwords — não chama nenhuma API.
///
/// Threshold conservador: só bloqueia a sugestão se há evidência clara de inglês.
/// Em caso de dúvida (texto curto, língua mista), retorna `false` para mostrar o ícone.
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

    // Muito curto → inconclusivo → não bloqueia (mostra ícone)
    if words.len() < 4 {
        return false;
    }

    let en_hits = words.iter()
        .filter(|w| EN_STOPWORDS.contains(&w.as_str()))
        .count();

    let pt_es_hits = words.iter()
        .filter(|w| PT_ES_STOPWORDS.contains(&w.as_str()))
        .count();

    // Assume inglês somente se:
    // 1. Tem mais stopwords EN que PT/ES
    // 2. A proporção EN é > 20% das palavras
    let ratio = en_hits as f32 / words.len() as f32;
    en_hits > pt_es_hits && ratio > 0.20
}
```

---

## Passo 4 — `selection_watcher.rs`

### 4.1 — Extrair função pura e testável

```rust
// src/tauri/src/selection_watcher.rs

use std::time::{Duration, Instant};
use tauri::AppHandle;
use crate::state::AppState;
use crate::types::{PendingSuggestion, TextSelectedPayload};
use crate::{text_bridge, lang_detect};

// ─── Constantes de timing ───────────────────────────────────────────────────

/// Distância mínima de drag para considerar como seleção (pixels)
const MIN_DRAG_PX: f64 = 5.0;

/// Debounce entre capturas consecutivas
const DEBOUNCE_MS: u64 = 300;

/// Delay após MouseUp para o SO processar a seleção
const SETTLE_MS: u64 = 120;

/// Comprimento mínimo do texto selecionado
const MIN_TEXT_LEN: usize = 2;

/// Comprimento máximo do texto (MVP)
const MAX_TEXT_LEN: usize = 500;

// ─── Função pura testável ────────────────────────────────────────────────────

/// Decide se deve tentar capturar a seleção dado um drag e o tempo desde a última captura.
/// Extraída como função pura para ser testável sem depender do rdev.
pub fn should_attempt_capture(drag_distance: f64, since_last_capture: Duration) -> bool {
    drag_distance >= MIN_DRAG_PX && since_last_capture >= Duration::from_millis(DEBOUNCE_MS)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn short_drag_is_ignored() {
        assert!(!should_attempt_capture(3.0, Duration::from_millis(500)));
    }

    #[test]
    fn long_drag_within_debounce_is_ignored() {
        assert!(!should_attempt_capture(50.0, Duration::from_millis(100)));
    }

    #[test]
    fn long_drag_after_debounce_is_captured() {
        assert!(should_attempt_capture(50.0, Duration::from_millis(400)));
    }

    #[test]
    fn exact_minimum_drag_is_accepted() {
        assert!(should_attempt_capture(5.0, Duration::from_millis(300)));
    }

    #[test]
    fn below_minimum_drag_is_rejected() {
        assert!(!should_attempt_capture(4.9, Duration::from_millis(1000)));
    }
}

// ─── Lógica de captura ───────────────────────────────────────────────────────

fn handle_potential_selection(app: AppHandle, cursor_x: f64, cursor_y: f64) {
    // Aguarda o SO processar a seleção
    std::thread::sleep(Duration::from_millis(SETTLE_MS));

    // Captura o texto selecionado (reutiliza text_bridge existente)
    let captured = match text_bridge::capture_selection() {
        Ok(Some(text)) => text,
        _ => return, // Sem seleção ou erro — silencioso
    };

    // Filtros de qualidade
    if captured.trim().len() < MIN_TEXT_LEN { return; }
    if captured.len() > MAX_TEXT_LEN { return; }

    // Gate de idioma: não mostrar sugestão para texto já em inglês
    if lang_detect::is_likely_english(&captured) { return; }

    // Armazenar no AppState para ser lido por suggestion_request (Fase 3)
    let state = app.state::<AppState>();
    match state.pending_suggestion.lock() {
        Ok(mut guard) => {
            *guard = Some(PendingSuggestion {
                original_text: captured.clone(),
                captured_at: Instant::now(),
                cursor_x: cursor_x as i32,
                cursor_y: cursor_y as i32,
            });
        }
        Err(e) => {
            eprintln!("[selection_watcher] failed to lock pending_suggestion: {}", e);
            return;
        }
    }

    // Emitir evento para o frontend mover o bubble
    app.emit("overlay:text-selected", TextSelectedPayload {
        text: captured,
        x: cursor_x as i32,
        y: cursor_y as i32,
    }).ok();
}

// ─── Watcher principal ───────────────────────────────────────────────────────

/// Inicia a thread de monitoramento de mouse em background.
/// Chama no `setup()` do main.rs após `app.manage(state)`.
pub fn start_watcher(app: AppHandle) {
    std::thread::spawn(move || {
        use rdev::{listen, EventType, Button};

        let mut mouse_down_pos: Option<(f64, f64)> = None;
        let mut last_capture_at = Instant::now().checked_sub(Duration::from_secs(10))
            .unwrap_or(Instant::now()); // inicializa "no passado" para permitir captura imediata

        if let Err(e) = listen(move |event| {
            match event.event_type {
                EventType::ButtonPress(Button::Left) => {
                    if let Some(pos) = event.position() {
                        mouse_down_pos = Some((pos.x, pos.y));
                    }
                }
                EventType::ButtonRelease(Button::Left) => {
                    let up_pos = match event.position() {
                        Some(p) => (p.x, p.y),
                        None => return,
                    };

                    if let Some(down) = mouse_down_pos.take() {
                        let drag_distance = ((up_pos.0 - down.0).powi(2)
                            + (up_pos.1 - down.1).powi(2))
                            .sqrt();

                        if !should_attempt_capture(drag_distance, last_capture_at.elapsed()) {
                            return;
                        }

                        last_capture_at = Instant::now();

                        // Captura em thread separada — rdev não pode bloquear
                        let app_handle = app.clone();
                        std::thread::spawn(move || {
                            handle_potential_selection(app_handle, up_pos.0, up_pos.1);
                        });
                    }
                }
                _ => {}
            }
        }) {
            eprintln!("[selection_watcher] rdev listen error: {:?}", e);
        }
    });
}
```

**Nota sobre `event.position()`:** a API exata do `rdev` pode variar entre versões. Verificar a versão do crate e adaptar se necessário. Em `rdev 0.5`, a posição vem em `EventType::MouseMove` acumulado — pode ser necessário rastrear a posição do mouse via `EventType::MouseMove` separadamente. Ver a documentação do crate após adicionar ao `Cargo.toml`.

---

## Passo 5 — Wire em `main.rs`

No bloco `setup`:

```rust
// src/tauri/src/main.rs

use crate::selection_watcher;

// Após app.manage(state):
selection_watcher::start_watcher(app.handle().clone());
```

Adicionar o módulo na lista de módulos do `main.rs`:

```rust
mod lang_detect;
mod selection_watcher;
```

---

## Verificação da Fase 1

```bash
cargo test  # testes de lang_detect e selection_watcher devem passar
cargo build # zero warnings
```

### Checklist de saída

- [ ] `Cargo.toml` tem `rdev = "0.5"`
- [ ] `lang_detect.rs` criado com todos os testes passando (≥ 7 testes)
- [ ] `selection_watcher.rs` criado com testes de `should_attempt_capture` passando
- [ ] `types.rs` tem `PendingSuggestion`, `TextSelectedPayload`, `SuggestionResponse`
- [ ] `state.rs` tem campo `pending_suggestion: Mutex<Option<PendingSuggestion>>`
- [ ] `shortcuts.rs` sem registro do `Ctrl+Alt+Shift+T`
- [ ] `commands/overlay.rs` sem `overlay_translate` e `do_translate`
- [ ] `cargo build` limpo, zero warnings
- [ ] `cargo test` passando
- [ ] **Teste manual:** selecionar texto em português no Notepad → log `[selection_watcher]` confirma captura + evento emitido
- [ ] **Teste manual:** selecionar texto em inglês → nenhum evento emitido (gate funcionou)

---

## Arquivos Criados nesta Fase

- `src/tauri/src/lang_detect.rs`
- `src/tauri/src/selection_watcher.rs`

## Arquivos Modificados nesta Fase

- `src/tauri/Cargo.toml`
- `src/tauri/src/types.rs`
- `src/tauri/src/state.rs`
- `src/tauri/src/shortcuts.rs`
- `src/tauri/src/commands/overlay.rs`
- `src/tauri/src/main.rs`
