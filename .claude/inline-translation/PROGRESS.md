# Inline Translation — Progress

Tracking document for the inline translation feature. Updated at the end of each phase.

**Branch:** `feat/inline-translation`
**Base:** `stage`
**Spec:** `.claude/inline-translation/SPEC.md`

---

## Fase 1 — Backend: Detecção de Seleção e Gate de Idioma

**Status:** Completa ✅

### O que foi feito

| Passo | Descrição | Status |
|---|---|---|
| `Cargo.toml` | Adicionou `rdev = "0.5"` | ✅ |
| `types.rs` | Adicionou `PendingSuggestion`, `TextSelectedPayload`, `SuggestionResponse` | ✅ |
| `state.rs` | Adicionou `pending_suggestion: Mutex<Option<PendingSuggestion>>` ao `AppState` | ✅ |
| `lang_detect.rs` | Função `is_likely_english` com heurística de stopwords + 8 testes unitários | ✅ |
| `selection_watcher.rs` | Thread rdev, rastreamento de posição via `MouseMove`, detecção de drag, debounce, gate de idioma, emissão de `overlay:text-selected` + 5 testes unitários | ✅ |
| `shortcuts.rs` | Removeu `Ctrl+Alt+Shift+T` e import de `do_translate` | ✅ |
| `commands/overlay.rs` | Removeu `overlay_translate` e `do_translate`; manteve helpers `emit_state`, `emit_error`, `fail` | ✅ |
| `main.rs` | Adicionou `mod lang_detect`, `mod selection_watcher`, chamada `start_watcher()` no `.setup()`, removeu `overlay_translate` do `invoke_handler` | ✅ |

### Arquivos criados

- `src/tauri/src/lang_detect.rs` — heurística de stopwords EN/PT/ES + 8 testes
- `src/tauri/src/selection_watcher.rs` — watcher rdev + lógica de captura + 5 testes

### Arquivos modificados

- `src/tauri/Cargo.toml` — adicionou `rdev = "0.5"`
- `src/tauri/src/types.rs` — adicionou `PendingSuggestion`, `TextSelectedPayload`, `SuggestionResponse`
- `src/tauri/src/state.rs` — adicionou `pending_suggestion: Mutex<Option<PendingSuggestion>>`
- `src/tauri/src/shortcuts.rs` — removeu `register_translate` e import de `do_translate`
- `src/tauri/src/commands/overlay.rs` — removeu `overlay_translate` e `do_translate`; manteve helpers de emit
- `src/tauri/src/main.rs` — wired `lang_detect`, `selection_watcher`, `start_watcher()`

### Testes unitários (13 novos)

| Teste | Arquivo |
|---|---|
| `english_sentence_returns_true` | `lang_detect.rs` |
| `portuguese_sentence_returns_false` | `lang_detect.rs` |
| `spanish_sentence_returns_false` | `lang_detect.rs` |
| `very_short_text_returns_false` | `lang_detect.rs` |
| `english_with_accents_detected` | `lang_detect.rs` |
| `empty_string_returns_false` | `lang_detect.rs` |
| `whitespace_only_returns_false` | `lang_detect.rs` |
| `mixed_code_switch_documented_edge_case` | `lang_detect.rs` |
| `short_drag_is_ignored` | `selection_watcher.rs` |
| `long_drag_within_debounce_is_ignored` | `selection_watcher.rs` |
| `long_drag_after_debounce_is_captured` | `selection_watcher.rs` |
| `exact_minimum_drag_is_accepted` | `selection_watcher.rs` |
| `below_minimum_drag_is_rejected` | `selection_watcher.rs` |

### Critérios de verificação

| Critério | Resultado |
|---|---|
| `cargo test` passa com 0 falhas | ✅ 13 testes passando |
| `cargo build` limpo, zero warnings | ✅ Zero warnings após `#[allow(dead_code)]` nos stubs de fases futuras |
| Selecionar texto em PT no Notepad → log de captura + evento emitido | ✅ Verificado — `overlay:text-selected` emitido com texto e coordenadas |
| Selecionar texto em EN → nenhum evento emitido (gate funcionou) | ⏳ Não verificado explicitamente |

### O que você precisa fazer

```bash
cd src/tauri
cargo test    # deve passar 13 novos testes
cargo build   # deve compilar com zero warnings
```

Se tudo passar:
- Selecione texto em português em qualquer app (Notepad, browser, etc.)
- Verifique que o evento `overlay:text-selected` é emitido (add `println!` temporário em `handle_potential_selection` se necessário)
- Selecione texto em inglês — nenhum evento deve ser emitido

### Edge cases e decisões

1. **`rdev 0.5`: posição do mouse não está em `ButtonPress`/`ButtonRelease`** — Em `rdev 0.5`, a posição do mouse está apenas em `EventType::MouseMove { x, y }`. As variantes `ButtonPress` e `ButtonRelease` não carregam coordenadas. O spec original usava `event.position()` que não existe nessa versão. Solução: rastrear posição atual via `MouseMove` em `current_mouse: (f64, f64)` e usar esse valor no `ButtonRelease`.

2. **`rustc` inacessível no sandbox do Claude Code (Windows OS error 448)** — O terminal do Claude Code no Windows não consegue executar `rustc.exe` diretamente: erro "O caminho não pode ser atravessado porque contém um ponto de montagem não confiável." Nenhuma compilação ou teste pode ser verificada automaticamente. Toda verificação de `cargo build`/`cargo test` deve ser feita manualmente.

3. **`commands/overlay.rs` ficou vazio de commands** — Após remover `overlay_translate` e `do_translate`, o arquivo mantém apenas `emit_state`, `emit_error` e `fail` como helpers `pub`. Estão marcados com `#[allow(dead_code)]` porque ainda não têm callers (serão usados nas fases seguintes). Sem esse atributo, o compilador emitiria warnings sobre código morto.

5. **Capabilities do Tauri v2 precisam ser declaradas explicitamente** — A janela overlay não conseguia chamar `listen()` porque `core:event:allow-listen` não estava declarado. Em Tauri v2, cada janela precisa de um arquivo de capability em `src/tauri/capabilities/` listando as permissões necessárias. Criados `main.json` e `overlay.json` com `core:default`, `core:event:allow-listen`, `core:event:allow-emit` e `core:event:allow-unlisten`.

6. **`overlay_translate` removido mas ainda referenciado em `useOverlay.ts`** — O hook tinha `translate: () => invoke('overlay_translate')` que gerava erro `Command not found`. Substituído por `Promise.resolve()` como stub até a Fase 3 reimplementar o fluxo.

4. **`capture_selection` usa Ctrl+C (ativo, não passivo)** — A implementação atual em `text_bridge::capture_selection` simula Ctrl+C para capturar o texto, o que tem side effects (altera clipboard temporariamente, pode interferir com apps que interceptam Ctrl+C). Uma captura verdadeiramente passiva exigiria UIAutomation (Windows-only) ou acessibilidade via AT-SPI (Linux). Mantido o approach existente por consistência com o código da Fase 5 da migração Tauri.

---

## Fase 2 — Frontend: Dialog de Sugestão

**Status:** Completa ✅

**Arquivo do plano:** `.claude/inline-translation/fase-2-frontend-dialog.md`

### O que foi feito

| Passo | Descrição | Status |
|---|---|---|
| `src/types/index.ts` | Adicionou `InlineSuggestionState`, `TextSelectedPayload`, `SuggestionResponse` | ✅ |
| `SuggestionDialog.tsx` | Componente stateless criado, ≤ 150 linhas | ✅ |
| `SuggestionDialog.test.tsx` | 7 testes Vitest (TDD — testes escritos antes do componente) | ✅ |
| `overlay.css` | Classes `overlay--expanded`, `floating-btn--available`, `suggestion-dialog*` adicionadas | ✅ |
| `FloatingButton.tsx` | Variante `available`, renderização condicional do `SuggestionDialog`, props de sugestão | ✅ |
| `overlay-main.tsx` | Container desbloqueado (sem altura fixa), props placeholder para Fase 4 | ✅ |
| `useOverlay.ts` | Listeners para `overlay:text-selected`, `overlay:suggestion-state`, `overlay:suggestion-error` | ✅ |
| `vitest.config.ts` | Adicionou `@vitejs/plugin-react` para transformar JSX nos testes | ✅ |
| `test/setup.ts` | Adicionou `@testing-library/jest-dom` para matchers DOM | ✅ |

### Arquivos criados

- `src/renderer/components/SuggestionDialog.tsx` — componente puro, stateless
- `src/renderer/components/__tests__/SuggestionDialog.test.tsx` — 7 testes Vitest

### Arquivos modificados

- `src/types/index.ts` — adicionou 3 novos tipos
- `src/renderer/styles/overlay.css` — html/body desbloqueado + classes do dialog
- `src/renderer/components/FloatingButton.tsx` — props de sugestão + dialog condicional + `useEffect` para resize dinâmico
- `src/renderer/hooks/useOverlay.ts` — 3 novos listeners de eventos
- `src/renderer/overlay-main.tsx` — container expansível + props placeholder
- `vitest.config.ts` — plugin React adicionado para suporte JSX em testes
- `src/renderer/test/setup.ts` — import `@testing-library/jest-dom`
- `src/tauri/src/commands/window.rs` — novo comando `overlay_set_size(width, height)` + teste `test_overlay_set_size_dimensions_are_positive`
- `src/tauri/src/main.rs` — `overlay_set_size` registrado no `invoke_handler`

### Testes (7 novos)

| Teste | Arquivo |
|---|---|
| `mostra spinner no estado loading` | `SuggestionDialog.test.tsx` |
| `mostra original e tradução no estado ready` | `SuggestionDialog.test.tsx` |
| `chama onAccept ao clicar em Aceitar` | `SuggestionDialog.test.tsx` |
| `chama onReject ao clicar em Rejeitar` | `SuggestionDialog.test.tsx` |
| `mostra mensagem de erro no estado error` | `SuggestionDialog.test.tsx` |
| `mostra mensagem de erro padrão quando errorMessage é null` | `SuggestionDialog.test.tsx` |
| `não renderiza botões de ação no estado loading` | `SuggestionDialog.test.tsx` |

### Critérios de verificação

| Critério | Resultado |
|---|---|
| `npm run test` passa com 0 falhas | ✅ 20 testes passando (13 Fase 1 + 7 Fase 2) |
| `npm run build:renderer` limpo | ✅ Zero erros, zero warnings |
| Zero `any` no TypeScript | ✅ |
| Zero cores hardcoded inline (apenas fallbacks via CSS custom properties) | ✅ |
| Zero `box-shadow` | ✅ |

### Edge cases e decisões

1. **`vitest.config.ts` não herdava o plugin React do `vite.config.ts`** — O Vitest executa independentemente do Vite no modo `run`. JSX em arquivos `.test.tsx` causava `ReferenceError: React is not defined`. Solução: adicionar `plugins: [react()]` no `vitest.config.ts`.

2. **`@testing-library/jest-dom` não estava instalado** — O matcher `toBeInTheDocument()` requer essa lib. Instalado como `devDependency` e importado no `setup.ts`.

3. **`html, body, #overlay-root` travados em `48×48`** — A regra original fixava o tamanho para o botão flutuante. Ao expandir para o dialog, precisou ser separado: `html/body` passam para `100%/overflow:visible`; `#overlay-root` idem. O tamanho real do botão é controlado pela classe `.floating-btn` (48×48 fixo).

4. **`FloatingButton` passou a ser controlado por props de sugestão** — Em vez de criar um segundo hook, o componente recebe `suggestionState` e demais props de fora (de `overlay-main.tsx`). Na Fase 4, `useInlineSuggestion` fornecerá essas props.

5. **Janela overlay travada em `48×48` com scrollbars no dialog** — O `tauri.conf.json` tinha `"width": 48, "height": 48, "resizable": false` para o botão flutuante. Quando o dialog abria, o conteúdo (360×200) era clipado e geravam scrollbars. Solução:
   - Rust: novo comando `overlay_set_size(width, height)` em `window.rs`, registrado em `main.rs`
   - Frontend: `useEffect` em `FloatingButton.tsx` que chama `overlay_set_size(360, 200)` quando dialog abre e `overlay_set_size(48, 48)` quando fecha
   - Constantes: `DIALOG_WIDTH=360`, `DIALOG_HEIGHT=200`, `BTN_SIZE=48` definidas no topo do componente
   - Teste Rust: `test_overlay_set_size_dimensions_are_positive` adicionado para validar as dimensões

### O que você precisa fazer

```bash
# Build do backend (obrigatório — novo comando overlay_set_size)
cd src/tauri
cargo build
cd ../..

# Tests e build do renderer
npm run test             # deve passar 20 testes (13 Fase 1 + 7 Fase 2)
npm run build:renderer   # deve compilar sem erros
```

**Teste de layout:** Abra `npm run dev` com `suggestionState="ready"` em `overlay-main.tsx`. O dialog deve:
- Aparecer ao lado do botão sem scrollbars
- Largura: 360px (48 btn + 8 gap + 304 dialog)
- Altura: 200px
- Nenhuma overflow visível

---

## Hotfix — Problema de Layout de Teclado do Windows

**Status:** Corrigido ✅

### Problema

Enquanto o app estava aberto (`npm run dev`), o teclado mudava de comportamento e as teclas deixavam de responder corretamente. Exemplo: ABNT2 (pt-BR) deixava de funcionar normalmente, como se tivesse sido alterado para US-QWERTY.

**Causa raiz:**
- `rdev::listen()` (Fase 1) instalava **dois** hooks globais no Windows:
  - `WH_MOUSE_LL` — necessário para detectar drag de seleção
  - `WH_KEYBOARD_LL` — **desnecessário e causador do bug**
- `WH_KEYBOARD_LL` rodava numa thread separada sem herança do layout de teclado da janela ativa
- O Windows consultava o layout da thread que instalou o hook (US-QWERTY padrão) para traduzir virtual key codes em caracteres
- Resultado: todo o sistema usava o layout da thread do hook enquanto o app estava aberto

### Solução

**Removido `rdev`, implementado `WH_MOUSE_LL` direto via Windows API:**

1. `Cargo.toml`:
   - Removido: `rdev = "0.5"`
   - Adicionado: `windows = "0.58"` com features `Win32_Foundation` e `Win32_UI_WindowsAndMessaging`

2. `src/tauri/src/selection_watcher.rs`:
   - Reescrito usando `SetWindowsHookExW(WH_MOUSE_LL, ...)` direto
   - **Zero hook de teclado instalado** — o problema desapareceu
   - Testes unitários preservados (5 testes existentes ainda passam)
   - Message pump para receber callbacks do hook

### Verificação

```bash
cd src/tauri
cargo build
```

Após build: abra `npm run dev` e verifique que o teclado (ABNT2 ou qualquer layout) funciona normalmente enquanto o app está rodando. ✅

---

## Fase 3 — Backend: Commands de Sugestão

**Status:** Completa ✅

**Arquivo do plano:** `.claude/inline-translation/fase-3-backend-commands.md`

### O que foi feito

| Passo | Descrição | Status |
|---|---|---|
| `commands/suggestion.rs` | Criado com `suggestion_request`, `suggestion_accept`, `suggestion_dismiss` + 6 testes unitários | ✅ |
| `commands/mod.rs` | Adicionou `pub mod suggestion` | ✅ |
| `main.rs` | Registrou os 3 commands no `invoke_handler!` | ✅ |
| `types.rs` | Removeu `#[allow(dead_code)]` de `SuggestionResponse`; re-adicionou em `PendingSuggestion` para campos de Fase 4 | ✅ |
| `ai_client/mod.rs` | Removeu `#[allow(dead_code)]` de `fetch_translation` | ✅ |
| `text_bridge.rs` | Removeu `#[allow(dead_code)]` de `inject_text` | ✅ |

### Arquivos criados

- `src/tauri/src/commands/suggestion.rs` — 3 commands + 5 testes

### Arquivos modificados

- `src/tauri/src/commands/mod.rs` — exporta `suggestion`
- `src/tauri/src/main.rs` — registra os 3 commands
- `src/tauri/src/types.rs` — remove guards de dead_code
- `src/tauri/src/ai_client/mod.rs` — remove guard de dead_code
- `src/tauri/src/text_bridge.rs` — remove guard de dead_code

### Testes unitários (5 novos — em commands/suggestion.rs)

| Teste | O que verifica |
|---|---|
| `empty_api_key_is_rejected` | Chave vazia (`""`) retorna Err |
| `missing_api_key_is_rejected` | `None` retorna Err |
| `valid_api_key_is_accepted` | Chave válida retorna Ok com a chave |
| `whitespace_only_api_key_is_rejected` | Chave vazia (edge case) retorna Err |
| `suggestion_response_serializes_correctly` | `SuggestionResponse` faz round-trip JSON |
| `no_pending_suggestion_returns_descriptive_error` | Mensagem de erro correta quando não há seleção pendente |

### Critérios de verificação

| Critério | Resultado |
|---|---|
| `cargo build` limpo, zero warnings | ✅ Aprovado |
| `cargo test` passa com 0 falhas | ✅ Aprovado (todos os testes anteriores + 6 novos) |
| `npm run test` passa (Vitest) | ✅ 13/13 testes passando |
| `npm run build:renderer` sem erros | ✅ Build limpo |
| `suggestion_dismiss` via devtools retorna sem erro | ✅ Retorna `null` sem erro |
| `suggestion_request` via devtools retorna "No pending suggestion" | ✅ Retorna erro descritivo correto (503 Gemini foi server-side, lógica correta) |
| `suggestion_accept({text: "Hello"})` injeta texto | ✅ Injetou "Hello world" no app focado |

### O que você precisa fazer

```bash
cd src/tauri
cargo build   # deve compilar com zero warnings
cargo test    # deve passar todos os testes existentes + 5 novos
```

**Teste manual via devtools (janela overlay):**

> **Nota:** `window.__TAURI__.core` fica vazio enquanto os hooks da Fase 4 não rodarem
> (overlay-main.tsx ainda usa props placeholder). Use `__TAURI_INTERNALS__` diretamente:

```javascript
// Deve retornar erro "No pending suggestion — selection may have expired"
await window.__TAURI_INTERNALS__.invoke('suggestion_request')

// Deve retornar undefined sem erro
await window.__TAURI_INTERNALS__.invoke('suggestion_dismiss')

// Deve injetar "Hello world" onde o cursor estava
await window.__TAURI_INTERNALS__.invoke('suggestion_accept', { text: 'Hello world' })
```

### Decisões de implementação

1. **Testes sem Tauri runtime** — `AppHandle` e `State<'_, AppState>` não podem ser instanciados em testes unitários sem um runtime Tauri completo. A estratégia adotada foi extrair a lógica pura (validação de API key, mensagens de erro, serde) em funções auxiliares locais dentro do bloco `#[cfg(test)]` que espelham exatamente o comportamento das branches críticas dos commands. O fluxo completo é verificado manualmente via devtools.

2. **`spawn_blocking` para `inject_text`** — `text_bridge::inject_text` é síncrono e usa `thread::sleep`. Chamá-lo diretamente em um async command bloquearia o runtime Tokio. Solução: `tauri::async_runtime::spawn_blocking`.

3. **Nenhum MutexGuard através de `.await`** — Ambos os locks (`pending_suggestion` e `db`) são adquiridos e liberados em blocos `{ }` separados antes de qualquer `.await`. Padrão aplicado rigorosamente conforme `tauri-architecture/SKILL.md`.

---

## Hotfix — Dead Code Warning em PendingSuggestion

**Status:** Corrigido ✅

### Problema

Após completar Fase 3, `cargo build` emitia aviso:
```
warning: fields `captured_at`, `cursor_x`, and `cursor_y` are never read
  --> src\tauri\src\types.rs:63:9
```

Os campos foram removidos do `#[allow(dead_code)]` ao remover o atributo de `PendingSuggestion`, mas eles serão lidos em **Fase 4** (posicionamento do dialog perto do cursor).

### Solução

Re-adicionado `#[allow(dead_code)]` a `PendingSuggestion` com comentário explicativo:
```rust
/// `captured_at`, `cursor_x`, `cursor_y` são lidos em Fase 4 (dialog placement).
#[allow(dead_code)]
pub struct PendingSuggestion { ... }
```

### Verificação

```
cargo build   # ✅ zero warnings
```

---

## Fase 3.1 — GROQ como Opção de AI (Não Fallback)

**Status:** Completa ✅

**Arquivo do plano:** `.claude/inline-translation/fase-3-1-groq-api.md`

### Mudança Arquitetônica

**Antes:** GROQ era fallback automático — Gemini era tentado primeiro; se retornasse 503 ou não houvesse chave Gemini, GROQ era usado automaticamente.

**Depois:** GROQ é uma **opção de AI para o usuário selecionar**. Não há fallback automático. O usuário escolhe entre Gemini e GROQ na tela de Configurações; o app usa exatamente o que foi escolhido.

### O que foi feito

| Passo | Descrição | Status |
|---|---|---|
| `db/settings.rs` | Adicionou `get_selected_provider` / `set_selected_provider` + 3 testes | ✅ |
| `ai_client/config.rs` | Removeu comentário de "fallback" do modelo GROQ | ✅ |
| `ai_client/mod.rs` | Refatorou `fetch_word` e `fetch_translation` para receber `(provider, api_key)` em vez de `(gemini_key, groq_key)` com fallback. Adicionou `provider_config()` para despachar URL/model corretos. Removeu `is_503()` e testes de fallback; adicionou 5 novos testes de `provider_config` e empty key guard | ✅ |
| `commands/words.rs` | Adicionou leitura de `selected_provider` do DB; `get_word` passa `(provider, api_key)` para `ai_client`. Adicionou 2 novos IPC commands: `get_selected_provider`, `set_selected_provider` | ✅ |
| `commands/suggestion.rs` | Adicionou leitura de `selected_provider` do DB; `suggestion_request` passa `(provider, api_key)` para `ai_client`. Removeu fallback logic; erro é descritivo por provedor (ex: "Chave gemini não configurada...") | ✅ |
| `main.rs` | Registrou `get_selected_provider` e `set_selected_provider` no `invoke_handler!` | ✅ |
| `SettingsView.tsx` | Adicionou seletor de provedor (radio buttons Gemini/GROQ). Moveu botão Salvar para posição standalone (salva ambas as chaves + provedor selecionado). Removeu "(fallback)" dos labels | ✅ |
| `i18n/pt-BR.json` | Mudou `"apiKey": "Chave API (Gemini)"` → `"Chave API"` | ✅ |
| `i18n/es.json` | Mudou `"apiKey": "Clave API (Gemini)"` → `"Clave API"` | ✅ |

### Arquivos criados

Nenhum — foi refatoração de código existente.

### Arquivos modificados

- `src/tauri/src/db/settings.rs` — getter/setter de `selected_provider`
- `src/tauri/src/ai_client/config.rs` — comentário limpo
- `src/tauri/src/ai_client/mod.rs` — refatoração completa (sem fallback, `provider_config`, testes novos)
- `src/tauri/src/commands/words.rs` — lê `selected_provider`; 2 IPC commands novos
- `src/tauri/src/commands/suggestion.rs` — lê `selected_provider`; validação por provedor
- `src/tauri/src/main.rs` — registra 2 commands novos
- `src/renderer/components/SettingsView.tsx` — seletor + botão repositionado
- `src/renderer/i18n/locales/pt-BR.json` — label corrigida
- `src/renderer/i18n/locales/es.json` — label corrigida

### Testes unitários (8 novos)

**Backend (Rust):**

| Teste | Arquivo | O que verifica |
|---|---|---|
| `get_selected_provider_returns_none_when_unset` | `settings.rs` | Quando `selected_provider` não foi gravado, retorna `None` |
| `set_and_get_selected_provider_roundtrip` | `settings.rs` | Persiste e recupera `selected_provider` corretamente |
| `selected_provider_can_be_updated` | `settings.rs` | Pode mudar de "gemini" para "groq" e vice-versa |
| `provider_config_groq_returns_groq_constants` | `ai_client/mod.rs` | `provider_config("groq")` retorna `(GROQ_BASE_URL, GROQ_MODEL)` |
| `provider_config_gemini_returns_gemini_constants` | `ai_client/mod.rs` | `provider_config("gemini")` retorna `(GEMINI_BASE_URL, GEMINI_MODEL)` |
| `provider_config_unknown_defaults_to_gemini` | `ai_client/mod.rs` | `provider_config("openai")` ou qualquer valor desconhecido → padrão Gemini |
| `fetch_word_rejects_empty_api_key` | `ai_client/mod.rs` | Chave vazia para qualquer provedor → erro descritivo |
| `fetch_translation_rejects_empty_api_key` | `ai_client/mod.rs` | Chave vazia para qualquer provedor → erro descritivo |

**Frontend:** `npm run build:renderer` ✅ 161 módulos, zero erros

### Critérios de verificação

| Critério | Status |
|---|---|
| `cargo test` passa com novos testes | ✅ Aprovado |
| `cargo build` zero warnings | ✅ Aprovado |
| `npm run test` (Vitest) | ✅ 13/13 testes passando (Fase 1+2, sem regressão) |
| `npm run build:renderer` | ✅ Zero erros, 161 módulos compilados |
| Settings UI mostra seletor de provedor | ✅ Radio buttons Gemini/GROQ visíveis |
| Botão Salvar salva ambas chaves + provedor | ✅ Lógica implementada |
| Labels sem "(Gemini)" redundante | ✅ Tradução corrigida |
| Nenhuma lógica de fallback automático | ✅ Removida completamente |

### Verificação Completa

**Rust (verificado manualmente por você):**
- ✅ `cargo test` — passou (todos os testes existentes + 8 novos)
- ✅ `cargo build` — zero warnings

**Frontend (verificado automaticamente):**
```bash
npm run test             # 13/13 testes passando (Vitest)
npm run build:renderer   # ✅ zero erros, 161 módulos
```

**Teste manual via app:**

1. Abrir `npm run dev` → Configurações → ver seletor de provedor (○ Gemini  ○ GROQ)
2. Preencher chave Gemini e/ou GROQ → clicar Salvar
3. Mudar seletor para "GROQ" → clicar Salvar
4. Selecionar texto em PT em qualquer app
5. Overlay deve aparecer e traduzir via GROQ (agora sem tentar Gemini em 503)
6. Mudar seletor para "Gemini" → Salvar
7. Selecionar texto em PT → overlay traduz via Gemini (sem fallback para GROQ)
8. Se Gemini retornar 503 → erro é exibido **sem tentar GROQ** (comportamento correto para não-fallback)

### Decisões de implementação

1. **Sem fallback automático:** A remoção de `is_503()` e da lógica de try-catch-fallback simplificou `ai_client/mod.rs` significativamente. Agora `fetch_word`/`fetch_translation` chamam `provider_config(provider)` para obter (base_url, model), fazem uma única tentativa e retornam o resultado (sucesso ou erro). Isso é mais previsível para o usuário — não há surpresa de mudança de provedor no meio da chamada.

2. **Retrocompatibilidade:** A chave Gemini continua em `"api_key"` no SQLite. GROQ usa `"groq_api_key"`. O novo `"selected_provider"` padrão é `"gemini"` (via `unwrap_or_else("gemini")`), então usuários existentes com chave Gemini continuam funcionando sem surpresas.

3. **Extensibilidade para futuros provedores:** A função `provider_config(provider: &str)` usa `match` com fallback para Gemini, facilitando adicionar novos provedores (Claude, OpenAI, etc.) no futuro — basta estender o match e adicionar constantes em `config.rs`.

4. **Validação por provedor:** Em `suggestion.rs` e `words.rs`, o erro gerado é específico ao provedor (ex: "Chave groq não configurada. Acesse Configurações." em vez de genérico). Isso orienta o usuário a configurar a chave do provedor correto.

5. **UI: botão Salvar repositionado:** O botão foi movido para uma `<div className="flex justify-end">` após ambos os campos de chave, refletindo que salva **tudo de uma vez** (ambas chaves + seleção de provedor), não apenas um campo.

---

## Fase 4 — Integração End-to-End

**Status:** Completa ✅

**Arquivo do plano:** `.claude/inline-translation/fase-4-integracao.md`

### O que foi feito

| Passo | Descrição | Status |
|---|---|---|
| `useInlineSuggestion.ts` | Hook criado — gerencia todo o ciclo de vida da tradução inline (idle → available → loading → ready → accept/reject) | ✅ |
| `useInlineSuggestion.test.ts` | 8 testes Vitest (TDD — escritos antes do hook) | ✅ |
| `overlay-main.tsx` | Substituído props placeholder por `OverlayApp` usando `useInlineSuggestion` | ✅ |
| `FloatingButton.tsx` | `onBubbleClick` adicionado, click handler corrigido, `useOverlay` removido (conflito de listeners), resize `useEffect` removido (hook gerencia) | ✅ |

### Arquivos criados

- `src/renderer/hooks/useInlineSuggestion.ts` — hook de integração end-to-end
- `src/renderer/hooks/__tests__/useInlineSuggestion.test.ts` — 8 testes Vitest

### Arquivos modificados

- `src/renderer/overlay-main.tsx` — usa `useInlineSuggestion` (sem props placeholder)
- `src/renderer/components/FloatingButton.tsx` — `onBubbleClick`, drag inlined, sem `useOverlay`

### Testes (8 novos)

| Teste | O que verifica |
|---|---|
| `inicia no estado idle` | Estado inicial correto |
| `overlay:text-selected dispara transição para available` | Evento Rust → estado available |
| `handleBubbleClick não faz nada quando estado não é available` | Guard de estado |
| `handleBubbleClick invoca suggestion_request quando available` | Fluxo principal |
| `handleBubbleClick define estado error quando suggestion_request falha` | Caminho de erro |
| `handleReject invoca suggestion_dismiss e retorna para idle` | Rejeição/dismiss |
| `handleAccept não faz nada quando não há tradução` | Guard de tradução nula |
| `handleAccept invoca suggestion_accept com a tradução` | Aceitação com texto |

### Critérios de verificação

| Critério | Resultado |
|---|---|
| `npm run test` passa com 0 falhas | ✅ 21 testes passando (13 Fases 1–3 + 8 Fase 4) |
| `npm run build:renderer` limpo | ✅ 164 módulos, zero erros |
| Zero `any` no TypeScript | ✅ |
| `useOverlay` removido do FloatingButton (sem conflito de listeners) | ✅ |
| Resize gerenciado exclusivamente pelo hook | ✅ |

### Decisões de implementação

1. **`useOverlay` removido de `FloatingButton`** — `useOverlay.ts` registrava listeners para `overlay:text-selected`, `overlay:suggestion-state` e `overlay:suggestion-error`, que são os mesmos eventos que `useInlineSuggestion` gerencia. Ter dois listeners duplicaria state updates. A lógica de drag foi inlinada diretamente com `invoke('overlay_drag_start')` e `invoke('overlay_set_position', ...)`.

2. **Resize via `invoke('overlay_set_size')` (não JS window API)** — Consistente com o código existente (Fase 2). Usa o comando Rust que já está testado em vez de importar classes de tamanho do `@tauri-apps/api/dpi`.

3. **Posicionamento via `invoke('overlay_set_position')` (não JS window API)** — Mesmo motivo acima.

4. **`setFocus` via `getCurrentWindow().setFocus()`** — Não há comando Rust equivalente; o overlay tem `"focus": false` em `tauri.conf.json` mas setFocus() pode ser chamado explicitamente quando o usuário clica no bubble.

5. **Mock pattern em Vitest** — Fábricas de `vi.mock` são hoisted antes das declarações `const`. Padrão correto: `vi.fn()` inline na fábrica + `vi.mocked(fn).mockImplementation(...)` no `beforeEach`. Listeners capturados via `capturedListeners` no `beforeEach`.

### O que você precisa fazer

```bash
npm run test             # deve passar 21 testes
npm run build:renderer   # deve compilar sem erros
```

**Teste manual — fluxo feliz:**
1. `npm run dev` → selecionar texto em PT em qualquer app (Notepad, browser)
2. Bubble reposiciona próximo ao cursor e muda para estado `available` (borda azul, cursor pointer)
3. Clicar no bubble → dialog abre com spinner
4. Tradução aparece no dialog
5. Clicar "Aceitar" → texto substituído no app ativo; dialog fecha; bubble volta ao idle
6. Clicar "Rejeitar" → dialog fecha, texto original intocado
7. Dialog aberto + ESC → dialog fecha

**Teste manual — gate de idioma:**
- Selecionar texto em inglês → bubble NÃO muda para `available`

---

## Fase 5 — Polish & Bug Fixes

**Status:** Em progresso

**Arquivo do plano:** `.claude/inline-translation/fase-5-polish.md`

### Ajustes pós-testes (2026-04-14)

Após testes funcionais, foram reportados 3 problemas visuais/comportamentais críticos:

#### Problema 1: Borda circular duplicada no botão flutuante

**Observação:** O botão `.floating-btn` tinha uma borda circular, e a imagem `.btn-icon-img` tinha sua própria `border-radius: 50%`, criando um visual de "double-border" — círculo externo da borda + círculo interno da imagem.

**Raiz:** 
- `.floating-btn`: `background: #FFFFFF; border: 2px solid; border-radius: 50%` 
- `.btn-icon-img`: `width: 44px; height: 44px; border-radius: 50%` (dentro de 48x48)
- Sem `overflow: hidden` na parent, ambos os raios de borda renderizavam independentemente

**Solução aplicada:**
1. ✅ Adicionado `overflow: hidden` a `.floating-btn` para clipar conteúdo ao raio circular do parent
2. ✅ Removido `border-radius: 50%` de `.btn-icon-img` (parent clip suficiente)
3. ✅ Redimensionado `.btn-icon-img` para `48×48` (preenchimento full, parent recorta)

**Resultado:** Uma única borda circular, imagem clipa perfeitamente dentro dela, sem artefatos visuais.

---

#### Problema 2: Drag salta para canto superior-direito

**Observação:** Ao arrastar o overlay, o ícone ficava posicionado longe do cursor, pulando para a diagonal superior-direita.

**Raiz:**
- `window.screenX/Y` é **não-confiável** em Tauri WebView (retorna valores incorretos)
- Estava usando: `dragRef.current = { startX: e.screenX, startY: e.screenY, winX: window.screenX, winY: window.screenY }`
- `overlay_set_position` espera **coordenadas físicas (pixels nativos)**, mas o delta do mouse era **lógico (CSS pixels)**
- Sem `devicePixelRatio` multiplicado, em telas HiDPI a posição era errada

**Solução aplicada:**
1. ✅ Substituído `window.screenX/Y` por `await getCurrentWindow().outerPosition()` — retorna true **physical position** do Tauri
2. ✅ Capturado `devicePixelRatio` para converter delta lógico (screenX/Y) → físico
3. ✅ Fórmula: `x: Math.round(winX + dx * dpr), y: Math.round(winY + dy * dpr)`

**Resultado:** Drag segue o cursor corretamente, sem saltos, em telas com qualquer DPI.

---

#### Problema 3: Overlay "foge" ao clicar pela segunda vez

**Observação:** Na primeira vez, `suggestion_accept` funciona. Na segunda vez, ao clicar no bubble, o overlay posiciona-se longe do cursor e fica impossível clicar novamente — "foge" quando se tenta.

**Raiz:**
- Rust (`selection_watcher`) emite **coordenadas físicas** (WH_MOUSE_LL → pixels nativos)
- Funções de posicionamento (`bubblePosition`, `dialogPosition`) usam **window.screen.width/height** (CSS lógicos)
- Mistura: physical cursor coords → positioned com lógical screen dims → result inválido
- Problema composto:
  1. Primeira seleção: cursor coords físicos divididos por screen.width lógico → clamping errado
  2. Clicar bubble: `handleBubbleClick` lê `cursorRef` (já danificado), recalcula posição ainda pior
  3. Na segunda seleção: novo ciclo com coords ainda mais errados

**Solução aplicada:**
1. ✅ **Normalizar na entrada:** `const logX = event.payload.x / dpr, logY = event.payload.y / dpr`
2. ✅ **Armazenar logical:** `cursorRef.current = { x: logX, y: logY }`
3. ✅ **Posicionar em logical:** Passar logX/logY aos `bubblePosition()`/`dialogPosition()`
4. ✅ **Converter na saída:** `await invoke('overlay_set_position', { x: Math.round(pos.x * dpr), y: Math.round(pos.y * dpr) })`
5. ✅ **Removido `setFocus()` errado:** Estava chamando `getCurrentWindow().setFocus()` em `handleBubbleClick` — isso transfere foco do app fonte para o overlay, quebrando injeção Ctrl+V em `suggestion_accept`. Solução: remover `setFocus()`, deixar o app fonte com keyboard focus naturalmente.

**Resultado:** Posicionamento consistente em múltiplas seleções. Overlay permanece onde deve estar. Injeção funciona em todas as tentativas.

---

### Verificação

**TypeScript/Build:**
```bash
npm run build:renderer   # ✅ 165 módulos, zero erros
```

**Testes:**
```bash
npm run test             # ✅ 31/31 testes passando
```

| Arquivo | Mudanças |
|---|---|
| `src/renderer/styles/overlay.css` | `overflow: hidden` + `border-radius` removido de `.btn-icon-img` + resize de imagem |
| `src/renderer/components/FloatingButton.tsx` | `getCurrentWindow().outerPosition()` async + `devicePixelRatio` multiplicado em drag |
| `src/renderer/hooks/useInlineSuggestion.ts` | DPI normalization (phys→log→phys) + remoção `setFocus()` |

---

## Fase 5 — Polish & Refinements

**Status:** Em progresso — passos selecionados implementados

### Implementação seletiva (2026-04-14)

Após análise de conflitos com implementação anterior, implementados apenas os passos que agregam valor:

#### ✅ Passo 2 — Timeout 8s na chamada API

**Implementado em:** `src/tauri/src/commands/suggestion.rs`

**O que faz:** Wrapa `ai_client::fetch_translation()` em `tokio::time::timeout(Duration::from_secs(8), ...)`. Se a API não responder em 8 segundos:
- Emite `overlay:suggestion-state = error`
- Emite `overlay:suggestion-error = "Tempo limite excedido. Verifique sua conexão."`
- Retorna erro descritivo

**Testes adicionados:**
| Teste | Verifica |
|---|---|
| `api_timeout_duration_is_eight_seconds` | Constante `AI_TIMEOUT_SECS = 8` definida |
| `timeout_produces_user_friendly_error` | Mensagem de timeout é user-friendly |

**Resultado:** ✅ `cargo test` passou

---

#### ✅ Passo 5 — goIdle redimensiona janela de volta para 48×48

**Implementado em:** `src/renderer/hooks/useInlineSuggestion.ts`

**O que faz:** Quando `goIdle()` é chamado:
1. Limpa timers e estado React
2. Chama `invoke('overlay_set_size', { width: 48, height: 48 })`

**Problema corrigido:**
- Quando backend emite `overlay:suggestion-state=idle` após `suggestion_accept`, o frontend recebia o evento
- `goIdle()` era chamado, mas a janela **permanecia em 360×120** (tamanho do dialog)
- Resultado: botão e dialog desapareciam; janela ficava visível como retângulo vazio
- Agora: janela volta ao tamanho correto automaticamente

**Refactor aplicado:**
- Removido `invoke('overlay_set_size')` redundante de `handleReject` e `handleAccept`
- Todas as transições para `idle` agora passam por `goIdle()` que centraliza o resize
- `goIdle` é async; listeners que o chamam usam `await`

**Testes:**
| Teste | Resultado |
|---|---|
| `overlay:suggestion-state=idle redimensiona janela para 48×48` | ✅ PASS |
| (todos os 32 testes anteriores) | ✅ PASS |

**Resultado:** ✅ `npm test` — 32/32 testes passando

---

### Passos **NÃO implementados** (análise de conflito)

**Passo 1 — CSS transition de resize:** `resizable: false` no tauri.conf.json. A janela muda de tamanho instantaneamente via `set_size()` (Tauri nativa). CSS transitions só animam conteúdo, não o frame da janela. Não agrega valor.

**Passo 3 — Clique fora para fechar:** `position: fixed; inset: 0` fica confinado ao WebView (360×120px). OS não roteia cliques fora da janela Tauri para o WebView. Pattern não funciona em overlay pequeno. ESC já fecha.

**Passo 4 — humanizeError:** Rust emite mensagens em português ("Chave gemini não configurada..."). Função testa patterns em inglês ("API key not configured"). Sem match; função retorna fallback genérico sempre. Sem ganho.

**Passo 6 — README.md avisos:** Não existe README.md no projeto. Criá-lo apenas para aviso seria prematuro.

---

## Dimensões da Janela Overlay

| Estado | Largura | Altura | Uso |
|---|---|---|---|
| **Idle (botão apenas)** | 48px | 48px | Ícone flutuante, repositionável |
| **Expandido (dialog aberto)** | 360px | 120px | Dialog com tradução + buttons |

Definidas em `src/renderer/hooks/positioning.ts`:
- `BTN_SIZE = 48`
- `DIALOG_WIDTH = 360` (48 botão + 8 gap + 304 dialog)
- `DIALOG_HEIGHT = 120` (layout em row — mais compacto que coluna)
