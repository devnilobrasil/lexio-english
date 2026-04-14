# Fase 5 — Polish e Edge Cases

**Objetivo:** Cobrir todos os edge cases identificados no SPEC — timeouts, animação de transição, tratamento robusto de erros de rede, clique-fora para fechar, e segurança (aviso sobre campos de password). Ao final desta fase, a feature está pronta para merge.

**Referência:** `SPEC.md` — Seções 12 (Fases, itens da Fase 5), 14 (Riscos), 15 (Checklist)

---

## Skills e Modelo

**Modelo recomendado:** `claude-sonnet-4-6`
Esta fase é polish — CSS, timeouts em React, e mensagens de UX. Sem nova lógica Rust ou IPC. Sonnet é suficiente.

**Ler antes de implementar:**

| Skill | Por quê |
|---|---|
| `.claude/skills/lexio-design-system/SKILL.md` | Confirmar tokens antes de qualquer ajuste de CSS |
| `superpowers:verification-before-completion` | Rodar toda a checklist de merge antes de afirmar que está pronto |
| `superpowers:finishing-a-development-branch` | Orientação para merge, PR e cleanup do worktree |

---

## Pré-requisitos

- Fase 4 concluída com fluxo happy-path funcionando manualmente
- `npm test` passando
- `cargo test` passando

---

## Passo 1 — Animação de transição do resize

A janela overlay já foi configurada com `resizable: true`. Adicionar transição CSS para suavizar a expansão:

```css
/* src/renderer/styles/overlay.css */

/* Aplicar ao container raiz do overlay */
#overlay-root {
  transition: width 180ms ease-out, height 180ms ease-out;
}

.overlay--expanded {
  /* Garantir que o layout não trave durante a transição */
  overflow: visible;
}
```

**Nota:** A transição CSS age sobre o conteúdo, mas o resize físico da janela Tauri é feito via `window.setSize()` no hook. Para que a janela e o conteúdo sejam coerentes, garantir que o `setSize` é chamado **antes** de alterar o estado React que expande o container.

Ajuste em `useInlineSuggestion.ts` no `handleBubbleClick`:

```typescript
// Ordem correta:
await resizeWindow(360, 180);  // 1. janela primeiro
setState("loading");           // 2. React depois — não setState antes de resizeWindow
```

---

## Passo 2 — Timeout de requisição ao Gemini (8s)

Adicionar em `commands/suggestion.rs`, no `suggestion_request`:

```rust
// src/tauri/src/commands/suggestion.rs

use tokio::time::timeout;

// Substituir a chamada direta ao fetch_translation por:
let translation = match timeout(
    std::time::Duration::from_secs(8),
    ai_client::fetch_translation(&state.http, &api_key, &original_text)
).await {
    Ok(Ok(t)) => t,
    Ok(Err(e)) => {
        app.emit_to("overlay", "overlay:suggestion-state", "error").ok();
        app.emit_to("overlay", "overlay:suggestion-error", &e).ok();
        return Err(e);
    }
    Err(_) => {
        let msg = "Tempo limite excedido. Verifique sua conexão.".to_string();
        app.emit_to("overlay", "overlay:suggestion-state", "error").ok();
        app.emit_to("overlay", "overlay:suggestion-error", &msg).ok();
        return Err(msg);
    }
};
```

---

## Passo 3 — Clique fora para fechar o dialog

Em `SuggestionDialog.tsx`, adicionar overlay de clique-fora:

```tsx
// src/renderer/components/SuggestionDialog.tsx

// Adicionar wrapper com overlay de clique-fora:
export function SuggestionDialog({ onReject, ...props }: SuggestionDialogProps) {
  return (
    <>
      {/* Overlay transparente cobre toda a área fora do dialog */}
      <div
        className="suggestion-dialog__backdrop"
        onClick={onReject}
        aria-hidden
      />
      <div className="suggestion-dialog" onClick={(e) => e.stopPropagation()}>
        {/* ... conteúdo existente ... */}
      </div>
    </>
  );
}
```

```css
/* src/renderer/styles/overlay.css */

.suggestion-dialog__backdrop {
  position: fixed;
  inset: 0;
  background: transparent;
  z-index: 0;
}

.suggestion-dialog {
  /* Adicionar z-index para ficar acima do backdrop */
  position: relative;
  z-index: 1;
  /* ... demais estilos existentes ... */
}
```

---

## Passo 4 — Mensagens de erro amigáveis

Centralizar as mensagens em `useInlineSuggestion.ts`:

```typescript
// src/renderer/hooks/useInlineSuggestion.ts

function humanizeError(raw: unknown): string {
  const msg = typeof raw === "string" ? raw : "Erro desconhecido";
  if (msg.includes("API key not configured")) {
    return "API key não configurada. Acesse Configurações.";
  }
  if (msg.includes("No pending suggestion")) {
    return "Seleção expirou. Selecione o texto novamente.";
  }
  if (msg.includes("Tempo limite")) {
    return msg; // já é amigável (vem do Rust)
  }
  if (msg.includes("HTTP error") || msg.includes("API error")) {
    return "Falha na chamada à API. Verifique sua conexão.";
  }
  return "Erro ao traduzir. Tente novamente.";
}
```

Usar `humanizeError` no `catch` do `handleBubbleClick`:

```typescript
} catch (e) {
  setError(humanizeError(e));
  setState("error");
}
```

---

## Passo 5 — Expiração do estado `available` (rever implementação)

O timeout de 6s já foi implementado na Fase 4 via `setTimeout`. Verificar que ao expirar:

1. `goIdle()` é chamado — limpa estado
2. A janela **volta para a posição persistida** (não fica flutuando perto do cursor indefinidamente)

Adicionar a restauração de posição em `goIdle`:

```typescript
// src/renderer/hooks/useInlineSuggestion.ts

const goIdle = useCallback(async () => {
  clearAvailableTimer();
  clearReadyTimer();
  setState("idle");
  setOriginal("");
  setTranslation(null);
  setError(null);

  // Garantir que a janela voltou ao tamanho 48×48
  await resizeWindow(48, 48);

  // Restaurar posição persistida (posição salva no overlay-position.json)
  // O Rust mantém essa posição — o frontend só precisa garantir que não ficou expandido
}, [resizeWindow]);
```

---

## Passo 6 — Aviso de segurança sobre campos de password

Adicionar aviso no `README.md` do projeto e na página de Settings do app.

### README.md (raiz do projeto)

```markdown
## ⚠️ Aviso de Segurança — Inline Translation

A feature de tradução passiva detecta seleções de texto em qualquer aplicativo do sistema.
**Não use esta feature em campos de senha, dados bancários ou qualquer campo sensível.**

O Lexio usa simulação de Ctrl+C para capturar o texto, o que brevemente passa pelo clipboard do SO.
Desabilite a feature nas configurações se estiver trabalhando com dados confidenciais.
```

---

## Passo 7 — Verificação final completa

### Testes automatizados

```bash
cargo test          # Rust unit tests
npm test            # Vitest (SuggestionDialog + useInlineSuggestion)
npm run build:renderer  # zero erros, zero warnings
cargo build --release   # build de produção limpo
```

### QA manual — checklist completo

**Fluxo happy-path:**
- [ ] Selecionar texto PT-BR no Notepad → bubble reposiciona e fica `available`
- [ ] Selecionar texto ES no Word → bubble reposiciona e fica `available`
- [ ] Clicar no bubble → janela expande suavemente (180ms) → spinner aparece
- [ ] Tradução aparece → clicar "Aceitar" → texto substituído → janela encolhe → idle
- [ ] Clicar "Rejeitar" → janela encolhe → idle → texto original intocado

**Gate de idioma:**
- [ ] Selecionar texto em inglês → bubble NÃO muda para `available`

**Rejeição:**
- [ ] Dialog aberto → pressionar `ESC` → fecha → idle
- [ ] Dialog aberto → clicar fora do card → fecha → idle
- [ ] Timeout de 30s sem interação → dialog fecha sozinho

**Expiração do `available`:**
- [ ] Bubble fica `available` → esperar 6s sem clicar → volta ao idle automaticamente

**Erro de rede:**
- [ ] Desabilitar internet → selecionar → clicar no bubble → mensagem de erro amigável no dialog

**Clipboard:**
- [ ] Copiar texto (Ctrl+C) → selecionar outro texto → clipboard original preservado após bubble aparecer

**Áreas sensíveis (documentar, não bloquear):**
- [ ] Aviso de segurança está presente no README

---

## Verificação Final (Checklist de Merge do SPEC.md)

Antes de abrir PR, verificar **cada item** do checklist da Seção 15 do `SPEC.md`:

- [ ] Shortcut antigo `Ctrl+Alt+Shift+T` removido de `shortcuts.rs`
- [ ] `overlay_translate` e `do_translate` deletados
- [ ] `selection_watcher` registrado no setup
- [ ] `lang_detect.rs` com testes ≥ 80% de cobertura
- [ ] `pending_suggestion` no `AppState`
- [ ] `rdev` no `Cargo.toml`
- [ ] `SuggestionDialog.tsx` ≤ 150 linhas
- [ ] `useInlineSuggestion.ts` ≤ 150 linhas
- [ ] Zero `any` em TypeScript
- [ ] Zero cores hardcoded / zero `box-shadow` / zero gradientes
- [ ] `cargo build --release` limpo
- [ ] `cargo test` passando
- [ ] `npm run build:renderer` limpo
- [ ] `npm test` passando
- [ ] Todos os testes manuais acima verificados
- [ ] Aviso de segurança no README
- [ ] PR aberto contra `stage` (nunca `main`)
- [ ] Conventional commit message

---

## Após a Fase 5 — Finalização do Branch

Ler e seguir `superpowers:finishing-a-development-branch`:

1. Confirmar que todos os testes passam
2. Criar PR com base em `stage`
3. Limpar o worktree após merge

---

## Arquivos Modificados nesta Fase

- `src/renderer/components/SuggestionDialog.tsx` (clique-fora)
- `src/renderer/styles/overlay.css` (backdrop + transição)
- `src/renderer/hooks/useInlineSuggestion.ts` (humanizeError, goIdle com restore)
- `src/tauri/src/commands/suggestion.rs` (timeout 8s)
- `README.md` (aviso de segurança)
