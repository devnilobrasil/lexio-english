# Lexio — Especificação: Inline Translation Suggestion

**Objetivo:** Substituir o overlay de tradução atual (ativo, destrutivo, shortcut-based) por uma feature passiva inspirada no Grammarly desktop: o app detecta quando o usuário seleciona texto em qualquer aplicativo, reposiciona o bubble flutuante ao lado da seleção e, ao clicar no bubble, abre um diálogo com a tradução para inglês que o usuário pode **aceitar** (substitui o texto) ou **rejeitar** (dispensa o diálogo).

Esta é a **primeira de várias features** do mesmo estilo (improve text, rephrase, tone suggestion). O spec foca estritamente na tradução, mas a arquitetura é propositalmente extensível.

---

## 1. Contexto e objetivo

### Problema do fluxo atual

O overlay de tradução atual (pós-migração Tauri v2, commit `6de16dd`) funciona assim:

1. Usuário seleciona texto em qualquer app.
2. Usuário pressiona `Ctrl+Alt+Shift+T`.
3. Rust simula `Ctrl+C` → lê clipboard → chama Gemini → simula `Ctrl+V` substituindo a seleção.

Dois problemas fundamentais:

- **É ativo:** depende de o usuário lembrar de um shortcut obscuro. Para um app de aprendizado de inglês que quer reduzir atrito, isso é uma barreira.
- **É destrutivo:** o texto original é substituído in-place, sem preview nem confirmação. Erros de tradução ou mudanças de contexto involuntárias são irrecuperáveis.

### Visão da nova feature

O padrão **Grammarly desktop** resolve ambos: ao detectar texto que pode receber uma sugestão, mostra um indicador visual próximo ao texto; ao clicar no indicador, abre um card com a sugestão e botões explícitos de `Accept` / `Dismiss`. O usuário decide, nada é alterado sem permissão.

Aplicado ao Lexio: o bubble flutuante Tauri deixa de ser passivo (só arrastável) e se torna um **indicador contextual** que aparece ao lado do texto selecionado. Clicar nele abre o diálogo de sugestão de tradução.

### Escopo explícito desta spec

- **No escopo:** Detecção de seleção + reposicionamento do bubble + diálogo de aceitar/rejeitar tradução.
- **Fora do escopo:** Features `improve text`, `rephrase`, `tone suggestion` (cada uma terá spec próprio). Menu contextual no bubble para escolher entre ações (virá quando existir a segunda feature). Onboarding de permissões macOS. Substituição do Ctrl+C por UIAutomation nativa.

---

## 2. O que muda e o que não muda

### Muda

| Aspecto | Atual | Novo |
|---|---|---|
| Trigger | Shortcut global `Ctrl+Alt+Shift+T` | Hook global de mouseup → detecção automática de seleção |
| Ação do usuário | Apertar atalho | Clicar no bubble |
| Resultado | Texto substituído in-place silenciosamente | Diálogo com preview + botões Aceitar/Rejeitar |
| Estado do bubble | Só `idle`, `loading`, `success`, `error` | Adiciona `available` (sugestão disponível), `ready` (tradução pronta para mostrar) |
| Posição do bubble | Estática (persistida em `overlay-position.json`) | Dinâmica: reposiciona ao lado de cada seleção. Posição persistida só para o estado idle |
| Dimensão do overlay window | Fixa 48×48 | Dinâmica: 48×48 em idle, ~360×180 quando dialog aberto |
| Custo de API por seleção | 1 request a cada shortcut | Zero até o usuário clicar no bubble. Mostrar o ícone é gratuito |
| Atalho global | Registrado | Removido |

### Não muda

- A chamada ao Gemini via `ai_client::fetch_translation()` continua a mesma (mesmo prompt, mesmo modelo `gemini-2.0-flash`, mesmo endpoint).
- `capture_selection()` e `inject_text()` em `text_bridge.rs` são **reaproveitados**, não reescritos.
- `overlay.html` + `overlay-main.tsx` continuam sendo a entrada da overlay window.
- `overlay-position.json` continua persistindo a posição do bubble **quando em estado idle**.
- Atalhos globais `Ctrl+Alt+E` (toggle main) e `Ctrl+Alt+O` (toggle overlay visibility) permanecem.
- System tray, auto-updater, settings, busca de palavras — nada disso é tocado.

---

## 3. UX Flow completo

### Estados do bubble

```
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│  IDLE   │ → │AVAILABLE│ → │ LOADING │ → │  READY  │ → │  IDLE   │
└─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘
 48×48         48×48          360×180        360×180       48×48
 bubble        bubble         spinner        dialog        bubble
 padrão        c/ ícone       no dialog      completo      padrão
               de ação
```

### Fluxo detalhado

1. **Usuário seleciona texto** em qualquer aplicativo (Chrome, Word, VSCode, Notepad, etc).
2. **Hook global Rust** detecta `MouseUp` após um drag que cobriu distância > 5px. Debounce de 150ms.
3. **Captura opportunistic:** Rust simula `Ctrl+C`, lê o clipboard via `arboard`, restaura o clipboard original. Se o texto lido ≠ clipboard anterior → houve seleção real.
4. **Gate de idioma:** `lang_detect` verifica se o texto já é predominantemente inglês. Se sim → descarta, volta ao idle (sem gastar nem mostrar nada).
5. **Cursor lookup:** Rust obtém a posição atual do cursor (via `rdev` ou API do SO).
6. **Reposicionamento + mudança de estado:** Rust emite evento `overlay:text-selected` com `{text, x, y}`. Frontend:
   - Move a janela overlay para `(cursor_x + 12, cursor_y + 12)` via `window.setPosition()`.
   - Muda bubble para estado `available` (ícone muda — por exemplo de Lora-L para uma seta de tradução).
7. **Timeout de relevância:** se o usuário não clicar no bubble em 6 segundos, volta ao estado idle e bubble retorna à posição persistida.
8. **Usuário clica no bubble** (estado `available`):
   - Frontend invoca `suggestion_request()`.
   - Overlay window redimensiona para 360×180.
   - Estado muda para `loading` — spinner no dialog.
   - Rust chama `fetch_translation()` com o texto armazenado no `AppState` (ver seção 4).
9. **Resposta chega:**
   - **Sucesso:** estado muda para `ready`. Dialog renderiza:
     - Top: texto original (truncado a 3 linhas, Lora serif)
     - Meio: seta `→`
     - Bottom: texto traduzido (Lora serif)
     - Rodapé: botões `[Aceitar]` (primário) e `[Rejeitar]` (ghost)
   - **Erro:** dialog mostra mensagem de erro + botão `[Fechar]`. Volta ao idle após clique.
10. **Aceitar:**
    - Frontend invoca `suggestion_accept({text: translated})`.
    - Rust chama `inject_text()` — simula Ctrl+V no app original (que ainda tem a seleção).
    - Overlay window redimensiona de volta para 48×48.
    - Estado volta para idle, bubble retorna à posição persistida.
11. **Rejeitar (qualquer uma das formas):**
    - Clique no botão `[Rejeitar]`
    - `ESC` pressionado
    - Clique fora do dialog
    - Timeout de 30 segundos sem interação
    - → Frontend invoca `suggestion_dismiss()`. Overlay volta a 48×48 idle, texto original permanece intocado.

### Diagrama ASCII do dialog

```
┌──────────────────────────────────────────┐
│                                          │
│  Eu preciso melhorar meu inglês para    │
│  conseguir uma vaga melhor.              │
│                                          │
│                   ↓                      │
│                                          │
│  I need to improve my English to get    │
│  a better job.                           │
│                                          │
│              [ Rejeitar ]  [ Aceitar ]   │
└──────────────────────────────────────────┘
```

---

## 4. Arquitetura de janelas

### Decisão: uma janela overlay que redimensiona

A overlay window existente (`label: "overlay"` em `tauri.conf.json`) passa a ser **dinamicamente redimensionável**:

- **Estado A (48×48):** bubble idle ou bubble available. Mesma aparência visual de hoje, só muda o ícone no estado available.
- **Estado B (360×180):** dialog aberto. Janela cresce, bubble fica num canto superior-esquerdo do container React.

### Tradeoff considerado e rejeitado

Criar uma **segunda janela** dedicada ao dialog (`label: "suggestion"`) foi considerado. Rejeitado porque:
- Complicaria o posicionamento relativo (dialog teria que seguir o bubble).
- Foco dividido entre duas janelas always-on-top gera race conditions.
- `transparent: true` + `focus: false` são tricky de configurar consistentemente em múltiplas janelas.

### Configuração da overlay window (alterações em `tauri.conf.json`)

```json
{
  "label": "overlay",
  "width": 48,
  "height": 48,
  "minWidth": 48,
  "minHeight": 48,
  "maxWidth": 400,
  "maxHeight": 240,
  "resizable": true,
  "alwaysOnTop": true,
  "transparent": true,
  "decorations": false,
  "skipTaskbar": true,
  "focus": false
}
```

### Foco ao abrir o dialog

Hoje `focus: false` é obrigatório no estado idle (para o bubble não roubar foco do app ativo). Quando o dialog abre, o usuário **precisa** que a janela receba foco para `ESC` e cliques funcionarem. Solução:

- Chamar `window.setFocus()` no momento em que o dialog é aberto (Rust `suggestion_request` command).
- Ao fechar o dialog (accept/dismiss), chamar `window.setFocusable(false)` de volta — ou equivalente em Tauri v2.
- O app original perde foco por ~100ms durante o dialog. **Isso é aceitável** e até desejável (sinaliza ao usuário que ele está interagindo com o Lexio).

### State em memória (Rust)

O texto capturado e a posição do cursor precisam viver entre eventos. Adicionar ao `AppState`:

```rust
pub struct AppState {
    pub db: Mutex<Connection>,
    pub http: Client,
    // ... campos existentes ...

    // Novo: sugestão pendente
    pub pending_suggestion: Mutex<Option<PendingSuggestion>>,
}

pub struct PendingSuggestion {
    pub original_text: String,
    pub captured_at: Instant,
    pub cursor_x: i32,
    pub cursor_y: i32,
}
```

Ciclo de vida do `pending_suggestion`:
- `Some(...)` quando `selection_watcher` captura texto válido.
- Lido por `suggestion_request` ao clicar no bubble.
- `None` após `suggestion_accept`, `suggestion_dismiss`, ou timeout (6s).

---

## 5. Detecção global de seleção

### Estratégia escolhida: hook global de mouse + captura oportunística

**Crate:** `rdev = "0.5"` — permite escutar eventos globais de mouse em todos os SOs suportados pelo Tauri. Alternativa: `device_query` (mais simples, mas só polling, não event-driven).

### Fluxo do selection watcher

```rust
// Pseudocódigo — src/tauri/src/selection_watcher.rs

pub fn start_watcher(app: AppHandle) {
    std::thread::spawn(move || {
        let mut mouse_down_pos: Option<(f64, f64)> = None;
        let mut last_capture_at = Instant::now();

        rdev::listen(move |event| {
            match event.event_type {
                EventType::ButtonPress(Button::Left) => {
                    mouse_down_pos = Some(current_mouse_position());
                }
                EventType::ButtonRelease(Button::Left) => {
                    let up_pos = current_mouse_position();
                    if let Some(down) = mouse_down_pos.take() {
                        let drag_distance = distance(down, up_pos);
                        // Ignora clique simples (sem drag significativo)
                        if drag_distance < 5.0 { return; }
                        // Debounce: não captura 2x em < 300ms
                        if last_capture_at.elapsed() < Duration::from_millis(300) { return; }
                        last_capture_at = Instant::now();

                        // Captura em thread separada — rdev não pode bloquear
                        let app_handle = app.clone();
                        std::thread::spawn(move || {
                            handle_potential_selection(app_handle, up_pos);
                        });
                    }
                }
                _ => {}
            }
        }).unwrap();
    });
}

fn handle_potential_selection(app: AppHandle, cursor_pos: (f64, f64)) {
    // Pequeno delay para o SO terminar de processar a seleção
    std::thread::sleep(Duration::from_millis(120));

    // Reutiliza função existente
    let captured = match text_bridge::capture_selection() {
        Ok(Some(text)) => text,
        _ => return,
    };

    // Filtros de qualidade
    if captured.trim().len() < 2 { return; }
    if captured.len() > 500 { return; } // tradução de texto muito longo: fora do MVP

    // Gate de idioma
    if lang_detect::is_likely_english(&captured) { return; }

    // Armazena no state
    let state = app.state::<AppState>();
    *state.pending_suggestion.lock().unwrap() = Some(PendingSuggestion {
        original_text: captured.clone(),
        captured_at: Instant::now(),
        cursor_x: cursor_pos.0 as i32,
        cursor_y: cursor_pos.1 as i32,
    });

    // Emite evento para o frontend
    app.emit("overlay:text-selected", TextSelectedPayload {
        text: captured,
        x: cursor_pos.0 as i32,
        y: cursor_pos.1 as i32,
    }).ok();
}
```

### Heurísticas anti-spam (já refletidas no pseudocódigo)

- **Drag mínimo:** ignora mouseup que veio de clique simples sem movimento (< 5px). Evita disparar a cada clique.
- **Debounce:** no máximo uma captura a cada 300ms. Evita disparar em cliques duplos ou arrastes fragmentados.
- **Comprimento mínimo:** texto < 2 chars não é considerado seleção útil.
- **Comprimento máximo:** texto > 500 chars é descartado no MVP (tradução de blocos grandes é caso de uso futuro).
- **Gate de idioma:** se já é inglês, não dispara.

### Problema explícito e aceito

Simular `Ctrl+C` silenciosamente em todo drag-release que passa pelas heurísticas **interfere potencialmente com o clipboard do usuário**. Mitigação:

- `capture_selection()` em `text_bridge.rs` (linhas 74-107) já **restaura o clipboard original** após a leitura.
- A janela de race onde o clipboard está "sujo" é < 100ms.
- Clipboard managers (Ditto, Win+V, Alfred) podem eventualmente registrar uma entrada extra durante essa janela. Aceito como limitação conhecida do MVP.

### Alternativa futura (fora do MVP)

Substituir o Ctrl+C por leitura direta via API de acessibilidade:
- **Windows:** crate `uiautomation` (lê `TextPattern` do elemento focado)
- **macOS:** FFI para `AXUIElementCopyAttributeValue(AXSelectedText)`
- **Linux:** AT-SPI

Vantagem: zero interferência com clipboard. Desvantagem: código specific-per-OS, requer Accessibility permission no macOS (bloqueia app se negada), complexidade alta. **Fica para v2 da feature.**

---

## 6. Detecção de idioma

### Objetivo

Não mostrar o ícone (nem chamar a API) se o texto selecionado já está predominantemente em inglês. Evita dois problemas:
- Desperdício de API calls.
- UX confusa: o usuário vê uma "sugestão" que é idêntica ao original.

### Abordagem: heurística local barata

**Não usar LLM** para detectar idioma — custaria o equivalente a 1 request por seleção. Usar **lista de stopwords**:

```rust
// src/tauri/src/lang_detect.rs

const EN_STOPWORDS: &[&str] = &[
    "the", "a", "an", "and", "or", "but", "is", "are", "was", "were",
    "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "will", "would", "could", "should", "may", "might", "to", "of",
    "in", "on", "at", "by", "for", "with", "about", "from", "i",
    "you", "he", "she", "it", "we", "they", "this", "that", "these",
    "those", "my", "your", "his", "her", "our", "their",
];

const PT_ES_STOPWORDS: &[&str] = &[
    // PT
    "o", "a", "os", "as", "um", "uma", "de", "do", "da", "em", "no",
    "na", "por", "para", "com", "que", "é", "são", "foi", "eu", "você",
    "ele", "ela", "nós", "eles", "meu", "seu", "não", "também",
    // ES
    "el", "la", "los", "las", "un", "una", "y", "o", "pero", "es",
    "son", "era", "eran", "ser", "estar", "tener", "hacer", "en",
    "por", "para", "con", "yo", "tú", "él", "ella", "nosotros",
];

pub fn is_likely_english(text: &str) -> bool {
    let words: Vec<&str> = text
        .split_whitespace()
        .map(|w| w.trim_matches(|c: char| !c.is_alphabetic()))
        .filter(|w| !w.is_empty())
        .collect();

    if words.len() < 2 { return false; } // muito curto → mostra mesmo assim

    let en_hits = words.iter()
        .filter(|w| EN_STOPWORDS.contains(&w.to_lowercase().as_str()))
        .count();
    let pt_es_hits = words.iter()
        .filter(|w| PT_ES_STOPWORDS.contains(&w.to_lowercase().as_str()))
        .count();

    // Regra: assume inglês só se tem mais stopwords EN que PT/ES E
    // se a proporção EN é > 25% das palavras
    en_hits > pt_es_hits && (en_hits as f32 / words.len() as f32) > 0.25
}
```

### Testes obrigatórios (ver seção 11)

- `"Hello world, how are you today?"` → true
- `"Olá mundo, como você está hoje?"` → false
- `"Hola mundo, cómo estás hoy?"` → false
- `"the cat"` → false (muito curto)
- `"I need to melhorar meu English"` (code-switch) → edge case, aceita-se qualquer resultado, documentar

---

## 7. Contrato IPC

### Commands novos (Rust → frontend)

```rust
// src/tauri/src/commands/suggestion.rs

/// Chamado quando o usuário clica no bubble em estado "available".
/// Lê `pending_suggestion` do AppState, dispara chamada ao Gemini,
/// retorna o texto traduzido. Não modifica nada no app-origem.
#[tauri::command]
pub async fn suggestion_request(
    state: State<'_, AppState>,
) -> Result<SuggestionResponse, String>;

/// Chamado quando o usuário clica "Aceitar" no dialog.
/// Simula Ctrl+V no app ativo para injetar a tradução,
/// limpa `pending_suggestion`, fecha o dialog (Rust emite overlay:suggestion-state=idle).
#[tauri::command]
pub async fn suggestion_accept(
    text: String,
    state: State<'_, AppState>,
) -> Result<(), String>;

/// Chamado quando o usuário clica "Rejeitar", pressiona ESC, ou clica fora.
/// Limpa `pending_suggestion`, emite overlay:suggestion-state=idle.
#[tauri::command]
pub fn suggestion_dismiss(
    state: State<'_, AppState>,
) -> Result<(), String>;
```

### Tipos compartilhados

```rust
// src/tauri/src/types.rs
#[derive(Serialize, Deserialize)]
pub struct SuggestionResponse {
    pub original: String,
    pub translation: String,
}

#[derive(Serialize, Clone)]
pub struct TextSelectedPayload {
    pub text: String,
    pub x: i32,
    pub y: i32,
}
```

### Events (Rust → frontend)

| Evento | Payload | Quando é emitido |
|---|---|---|
| `overlay:text-selected` | `TextSelectedPayload` | `selection_watcher` detectou seleção válida e já armazenou no state |
| `overlay:suggestion-state` | `"idle" \| "available" \| "loading" \| "ready" \| "error"` | Qualquer transição de estado do fluxo |
| `overlay:suggestion-error` | `String` (mensagem) | Erro ao chamar Gemini ou ao injetar texto |

### Commands e shortcuts removidos

- `overlay_translate` — substituído pelo novo fluxo; deletado de `commands/overlay.rs`.
- `do_translate()` (função interna) — deletada.
- Registro do shortcut `Ctrl+Alt+Shift+T` em `shortcuts.rs` (linhas 70-96) — removido.
- Evento `overlay:error` — renomeado para `overlay:suggestion-error` para clareza.

### Commands mantidos

- `overlay_drag_start`, `overlay_set_position` — continuam funcionando para arrastar o bubble no estado idle.

---

## 8. Frontend — React

### Arquivos a criar

#### `src/renderer/components/SuggestionDialog.tsx`

Componente puro, stateless, ≤ 150 linhas.

```typescript
interface SuggestionDialogProps {
  state: "loading" | "ready" | "error";
  original: string;
  translation: string | null;
  errorMessage: string | null;
  onAccept: () => void;
  onReject: () => void;
}

export function SuggestionDialog(props: SuggestionDialogProps) { /* ... */ }
```

**Regras de design (ver `LEXIO_DESIGN_SYSTEM.md`):**
- Container: `bg-surface-primary`, `border border-subtle`, **sem box-shadow**, `rounded-lg` (≤ 8px)
- Texto original: `font-serif` (Lora), `text-text-muted`
- Texto traduzido: `font-serif` (Lora), `text-text-primary`
- Botões: `font-sans` (Inter), `text-sm`, botão Aceitar com `bg-accent-bg text-accent-text`, Rejeitar ghost
- Zero cores hardcoded inline
- Zero gradientes

#### `src/renderer/hooks/useInlineSuggestion.ts`

Hook que orquestra o ciclo de vida:

```typescript
export function useInlineSuggestion() {
  const [state, setState] = useState<SuggestionState>("idle");
  const [original, setOriginal] = useState<string>("");
  const [translation, setTranslation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Escuta overlay:text-selected → transição para "available"
  // Escuta overlay:suggestion-state → sincroniza estado
  // Função handleBubbleClick → invoke('suggestion_request') → setState("loading")
  // Função handleAccept → invoke('suggestion_accept', {text: translation})
  // Função handleReject → invoke('suggestion_dismiss')
  // Listener global ESC key quando state === "ready"

  return { state, original, translation, error, handleBubbleClick, handleAccept, handleReject };
}
```

### Arquivos a modificar

#### `src/renderer/components/FloatingButton.tsx` (1-59)

- Adicionar estado visual `available` (ícone muda — por exemplo, uma seta `→` estilizada em vez do `L` do Lora)
- Adicionar modo `dialog`: quando o hook diz que o estado é `loading` | `ready` | `error`, o componente renderiza `<SuggestionDialog />` ao lado do bubble.
- Remover o handler de double-click que invoca `overlay_translate` (substituído por single-click no estado `available`).
- O drag-to-reposition só funciona em estado `idle`.

#### `src/renderer/hooks/useOverlay.ts` (1-28)

- Adicionar listener para `overlay:text-selected`
- Adicionar listener para `overlay:suggestion-state`
- Remover listener de `overlay:error` (renomeado para `overlay:suggestion-error`)

#### `src/renderer/overlay-main.tsx`

- Envolver `<FloatingButton />` em container flex que permite crescer de 48×48 para 360×180.
- Garantir que `html, body, #overlay-root` não têm altura fixa travada.

#### `src/renderer/styles/overlay.css`

- Novas classes:
  - `.overlay--expanded` — wrapper do modo dialog
  - `.suggestion-dialog` — container do card
  - `.suggestion-dialog__original`
  - `.suggestion-dialog__translation`
  - `.suggestion-dialog__actions`
  - `.floating-btn--available` — novo ícone
- Transição suave de 48×48 → 360×180 via `transition: width 180ms, height 180ms`.

#### `src/types/index.ts`

```typescript
export type InlineSuggestionState = "idle" | "available" | "loading" | "ready" | "error";

export interface TextSelectedPayload {
  text: string;
  x: number;
  y: number;
}

export interface SuggestionResponse {
  original: string;
  translation: string;
}
```

---

## 9. Backend Rust — arquivos novos e modificados

### Criar

| Arquivo | Responsabilidade |
|---|---|
| `src/tauri/src/selection_watcher.rs` | Thread do rdev, debounce, captura oportunística, emit do evento |
| `src/tauri/src/lang_detect.rs` | Heurística de stopwords EN vs PT/ES |
| `src/tauri/src/commands/suggestion.rs` | Commands `suggestion_request`, `suggestion_accept`, `suggestion_dismiss` |

### Modificar

| Arquivo | Alteração |
|---|---|
| `src/tauri/src/main.rs` | Chamar `selection_watcher::start_watcher(app.handle().clone())` no `setup()`. Registrar `PendingSuggestion` no `AppState::new()`. Registrar os 3 novos commands no `invoke_handler!`. |
| `src/tauri/src/state.rs` | Adicionar campo `pending_suggestion: Mutex<Option<PendingSuggestion>>` |
| `src/tauri/src/shortcuts.rs` (70-96) | **Remover** registro do shortcut `Ctrl+Alt+Shift+T`. Manter `Ctrl+Alt+E` e `Ctrl+Alt+O`. |
| `src/tauri/src/commands/overlay.rs` | **Deletar** `overlay_translate` e `do_translate`. Manter `overlay_drag_start` e `overlay_set_position`. |
| `src/tauri/src/commands/mod.rs` | Exportar `suggestion` module |
| `src/tauri/src/types.rs` | Adicionar `PendingSuggestion`, `TextSelectedPayload`, `SuggestionResponse` |
| `src/tauri/tauri.conf.json` (29-45) | Overlay window: adicionar `"resizable": true`, `"minWidth": 48`, `"minHeight": 48`, `"maxWidth": 400`, `"maxHeight": 240`. Width/height iniciais continuam 48×48. |
| `src/tauri/Cargo.toml` | Adicionar `rdev = "0.5"` |

---

## 10. Preservação do clipboard

Estratégia crítica para UX — se o clipboard do usuário ficar corrompido ou "sujo" frequentemente, a feature é inviável.

### O que `capture_selection()` já faz (não mexer)

Em `src/tauri/src/text_bridge.rs` (32-70):
1. Lê clipboard atual → `original`
2. Simula Ctrl+C
3. Aguarda 80ms (`COPY_SETTLE_MS`)
4. Lê clipboard novo → `captured`
5. Restaura `original` no clipboard

### Janela de race

Durante a etapa 3 (80ms), o clipboard contém o texto selecionado, não o valor original. Se outra aplicação (especialmente clipboard managers) ler o clipboard nesse intervalo, vai registrar o texto selecionado como uma "nova entrada".

### Mitigações no MVP

- **Nenhuma adicional** — aceita-se o comportamento atual do `capture_selection()`.
- A diferença vs. o overlay atual: agora isso acontece a cada mouseup com drag significativo, não só a cada shortcut. Frequência de captura aumenta ~10x.

### Testes manuais obrigatórios no QA

- Testar com **Ditto** (Windows) → verificar se o texto selecionado aparece no histórico do Ditto indevidamente.
- Testar com **Win+V** nativo do Windows → mesmo teste.
- Testar com **Alfred Clipboard** (macOS, quando suportado).
- Se interferência for inaceitável, elevar prioridade da migração para UIAutomation (seção 5, alternativa futura).

---

## 11. Estratégia de testes

### Rust unit tests

#### `lang_detect.rs`

```rust
#[test] fn english_simple_sentence_returns_true() {
    assert!(is_likely_english("The cat is on the table"));
}
#[test] fn portuguese_sentence_returns_false() {
    assert!(!is_likely_english("O gato está em cima da mesa"));
}
#[test] fn spanish_sentence_returns_false() {
    assert!(!is_likely_english("El gato está en la mesa"));
}
#[test] fn very_short_text_returns_false() {
    assert!(!is_likely_english("the cat"));
}
#[test] fn english_with_accents_still_detected() {
    assert!(is_likely_english("I love naïve café culture"));
}
#[test] fn mixed_language_leans_majority() {
    // "I need to melhorar meu English" → 3 EN vs 2 PT → true
    // Documentar como edge case aceito
}
```

#### `selection_watcher.rs`

Extrair a lógica de debounce/filtro para função pura testável:

```rust
fn should_capture(drag_distance: f64, since_last: Duration) -> bool;
```

Testar com tabela de casos. **Não testar** a integração com `rdev` em unit tests (seria teste de integração manual).

### Frontend Vitest

#### `SuggestionDialog.test.tsx`

- Renderiza `original` e `translation` props.
- Chama `onAccept` ao clicar em `[Aceitar]`.
- Chama `onReject` ao clicar em `[Rejeitar]`.
- Mostra spinner quando `state === "loading"`.
- Mostra `errorMessage` quando `state === "error"`.

#### `useInlineSuggestion.test.tsx`

- Mock de `invoke` e `listen` do `@tauri-apps/api`.
- Simula evento `overlay:text-selected` → verifica transição de estado.
- Simula clique no bubble → verifica chamada a `suggestion_request`.
- Simula accept → verifica chamada a `suggestion_accept` com o texto correto.

### E2E Playwright (ver `.claude/skills/lexio-testing/`)

- **Mock obrigatório do Gemini** — nunca chamar a API real em teste.
- Fluxo: dispara manualmente o evento `overlay:text-selected` via teste (bypass do hook de mouse), verifica que o bubble aparece no estado correto, clica no bubble, verifica que o dialog abre, aceita/rejeita, verifica chamadas IPC.
- **Não testar** o hook global de mouse em E2E — sistema-dependente, complexo, baixo ROI. Fica para QA manual.

---

## 12. Fases de execução

### Fase 1 — Backend: detecção e gate de idioma
1. Adicionar `rdev` ao `Cargo.toml`.
2. Criar `lang_detect.rs` + testes unitários.
3. Criar `selection_watcher.rs` (sem ainda conectar ao resto).
4. Adicionar `pending_suggestion` ao `AppState`.
5. Wire do watcher no `setup()` do `main.rs`.
6. Remover shortcut antigo de `shortcuts.rs`.
7. Remover `overlay_translate` e `do_translate` de `commands/overlay.rs`.
8. Teste manual: selecionar texto em qualquer app, verificar via log que o Rust capturou + detectou idioma + emitiu evento.

### Fase 2 — Frontend: componente dialog isolado
1. Criar `SuggestionDialog.tsx` com props fixas (sem lógica).
2. Criar CSS das classes novas em `overlay.css`.
3. Adicionar nova variante de ícone em `FloatingButton.tsx` (estado `available`).
4. Validar visualmente numa rota de dev (`/dev-suggestion-dialog`) ou usando Vitest com snapshot.
5. Rodar `npm run build:renderer` — zero warnings.

### Fase 3 — Backend: commands de suggestion
1. Criar `commands/suggestion.rs` com os 3 commands.
2. Registrar no `invoke_handler!` do `main.rs`.
3. Testar invocações isoladamente via Tauri devtools (`__TAURI__.core.invoke(...)`).

### Fase 4 — Integração end-to-end
1. Criar `useInlineSuggestion.ts` orquestrando o fluxo completo.
2. Conectar `FloatingButton.tsx` ao hook.
3. Wire da window resize ao estado do dialog.
4. Testar fluxo real: selecionar texto → bubble move → clica → dialog → accept → texto substituído.
5. Testar rejeição em todas as suas formas (botão, ESC, clique-fora, timeout).

### Fase 5 — Polish
1. Timeout de 6s no estado `available` (bubble volta ao idle se ignorado).
2. Timeout de 30s no estado `ready` (dialog fecha se ignorado).
3. Timeout de 8s na requisição ao Gemini (evita spinner eterno).
4. Erro de rede → mensagem amigável no dialog.
5. Animação de transição window size (180ms).
6. Ícone do estado `available` — design refinado seguindo o design system.

---

## 13. Extensibilidade para features futuras

Features que virão nas próximas specs (`.claude/inline-rephrase/`, `.claude/inline-improve/`, `.claude/inline-tone/`): todas compartilham o mesmo padrão de **texto selecionado → sugestão → aceitar/rejeitar**.

### O que é reutilizável sem modificação

- `selection_watcher.rs` — dispara o mesmo evento `overlay:text-selected` independente da feature.
- `capture_selection()` / `inject_text()` — agnósticos.
- `SuggestionDialog.tsx` — já é puro, recebe `{original, suggestion, ...}` — pode aceitar uma prop `variant: "translate" | "rephrase" | "improve" | "tone"` para variar títulos/cores.
- `lang_detect.rs` — só usado como gate pelo `selection_watcher`; features futuras podem ignorar ou usar gates próprios.

### O que precisará mudar quando existir a segunda feature

- **Menu contextual no bubble:** hoje o bubble `available` dispara a única ação (tradução). Quando houver 2+ features, clicar no bubble deve abrir um mini-menu de ações. O bubble vira uma dropdown.
- **Commands parametrizados:** `suggestion_request` vira `suggestion_request(variant: String)`, roteando para diferentes prompts em `ai_client/`.
- **Prompts dedicados:** cada feature tem seu próprio arquivo em `ai_client/` (`rephrase_prompt.rs`, `improve_prompt.rs`, `tone_prompt.rs`).

**Este spec NÃO implementa o menu contextual.** Clicar no bubble dispara tradução diretamente. O refactor para menu fica para a spec da segunda feature.

---

## 14. Riscos e tradeoffs

| Risco | Impacto | Mitigação |
|---|---|---|
| Interferência com clipboard do usuário (Ctrl+C a cada drag) | Médio | `capture_selection()` já restaura clipboard. Janela de race <100ms. Futura migração para UIAutomation se inaceitável. |
| Permissão de Accessibility no macOS (rdev pode exigir) | Alto no macOS, N/A no Windows | MVP foca em Windows. macOS precisará de onboarding de permissão — spec separado. |
| Falsos positivos (mouseup que não é seleção real) | Baixo | Heurística de drag mínimo (5px) + debounce 300ms + comprimento mínimo do texto. |
| Custo de API (toda seleção dispara request) | **Nenhum** | Request **só é feito quando o usuário clica no bubble**, não quando o ícone aparece. Ver o ícone é gratuito. |
| rdev flagged por antivírus no Windows | Baixo | Documentar no README e na página de settings. `rdev` é uma crate popular e legítima. |
| Overlay window resize causando flicker | Médio | `transparent: true` + transição CSS de 180ms. Testar em displays de alta DPI. |
| Conflito de foco: dialog precisa de foco, app origem perde | Baixo (desejável) | Ao aceitar, o Ctrl+V é enviado antes do usuário clicar de volta no app — testar se a seleção original ainda está lá. |
| Texto muito longo (> 500 chars) não é coberto | Baixo | Documentado como limitação do MVP. Feature de "tradução de bloco" vira spec separado. |
| Seleção em campos de password (captura senha!) | **Alto** | Não existe API confiável para detectar campos de password em apps externos. Mitigação: **avisar o usuário no onboarding** que a feature NÃO deve ser usada em campos sensíveis. Documentar explicitamente. Considerar desabilitar no primeiro uso. |

---

## 15. Checklist de pronto-para-merge

- [ ] Shortcut antigo `Ctrl+Alt+Shift+T` removido de `shortcuts.rs`
- [ ] `overlay_translate` e `do_translate` deletados de `commands/overlay.rs`
- [ ] `selection_watcher` registrado em `main.rs::setup()`
- [ ] `lang_detect.rs` com cobertura de testes ≥ 80%
- [ ] `pending_suggestion` adicionado ao `AppState`
- [ ] `rdev` adicionado ao `Cargo.toml`
- [ ] `SuggestionDialog.tsx` ≤ 150 linhas
- [ ] `useInlineSuggestion.ts` ≤ 150 linhas
- [ ] Zero `any` em TypeScript
- [ ] Zero cores hardcoded em JSX/CSS (tokens do design system)
- [ ] Zero `box-shadow`, zero gradientes
- [ ] `cargo build --release` limpo, sem warnings
- [ ] `cargo test` passando
- [ ] `npm run build:renderer` limpo
- [ ] `npm test` (Vitest) passando
- [ ] E2E Playwright mockando Gemini passando
- [ ] Teste manual: selecionar texto em 3 apps diferentes (Chrome, Word/LibreOffice, Notepad) → bubble aparece → clicar → dialog → aceitar substitui
- [ ] Teste manual: selecionar texto em inglês → bubble NÃO aparece (gate de idioma)
- [ ] Teste manual: clipboard do usuário preservado após 10 seleções consecutivas
- [ ] Teste manual: ESC fecha o dialog
- [ ] Teste manual: clique-fora fecha o dialog
- [ ] Documentação atualizada: `README.md` ou `CLAUDE.md` mencionando a nova feature
- [ ] Aviso explícito sobre campos de password no README
- [ ] PR aberto contra `stage` (nunca `main`)
- [ ] Conventional commit message
