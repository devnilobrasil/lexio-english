# Fase 2 — Frontend: Componente SuggestionDialog

**Objetivo:** Criar o componente `SuggestionDialog` isolado (sem lógica de estado ainda), atualizar o `FloatingButton` com a variante visual `available`, adicionar as classes CSS de expansão, e validar visualmente. Ao final desta fase, o dialog é renderizável com props fixas — o hook de orquestração vem na Fase 4.

**Referência:** `SPEC.md` — Seções 3 (UX Flow), 8 (Frontend — React), `LEXIO_DESIGN_SYSTEM.md`

---

## Skills e Modelo

**Modelo recomendado:** `claude-sonnet-4-6`
Esta fase é predominantemente React/CSS. Sem Rust, sem IPC complexa. Sonnet é suficiente.

**Ler antes de implementar:**

| Skill | Por quê |
|---|---|
| `.claude/skills/lexio-design-system/SKILL.md` | Tokens de cor, tipografia (Lora/Inter), regras visuais — **leitura obrigatória antes de escrever qualquer CSS ou JSX** |
| `.claude/skills/tauri-architecture/SKILL.md` | Padrão de `invoke`/`listen` para referência — o dialog vai usar esses em fases posteriores |

---

## Pré-requisitos

- Fase 1 concluída (critérios de saída verificados)
- `npm run build:renderer` passando (baseline verde)

---

## Estrutura de Arquivos desta Fase

```
src/renderer/
├── components/
│   ├── SuggestionDialog.tsx     ← NOVO
│   └── FloatingButton.tsx       ← MODIFICAR: variante available + modo dialog
├── hooks/
│   └── useOverlay.ts            ← MODIFICAR: novos listeners de eventos
├── overlay-main.tsx             ← MODIFICAR: container expansível
└── styles/
    └── overlay.css              ← MODIFICAR: classes de expansão + dialog

src/types/index.ts               ← MODIFICAR: novos tipos TS
```

---

## Passo 1 — Novos tipos em `src/types/index.ts`

Adicionar ao arquivo existente (não substituir tipos existentes):

```typescript
// src/types/index.ts

export type InlineSuggestionState =
  | "idle"
  | "available"
  | "loading"
  | "ready"
  | "error";

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

## Passo 2 — `SuggestionDialog.tsx`

Componente puro, stateless. Recebe tudo via props, não conhece IPC.
**Máximo 150 linhas.**

```tsx
// src/renderer/components/SuggestionDialog.tsx

import type { InlineSuggestionState } from "../../types";

interface SuggestionDialogProps {
  state: Extract<InlineSuggestionState, "loading" | "ready" | "error">;
  original: string;
  translation: string | null;
  errorMessage: string | null;
  onAccept: () => void;
  onReject: () => void;
}

export function SuggestionDialog({
  state,
  original,
  translation,
  errorMessage,
  onAccept,
  onReject,
}: SuggestionDialogProps) {
  return (
    <div className="suggestion-dialog">
      {state === "loading" && (
        <div className="suggestion-dialog__loading">
          <span className="suggestion-dialog__spinner" aria-label="Traduzindo..." />
        </div>
      )}

      {state === "ready" && translation && (
        <>
          <div className="suggestion-dialog__body">
            <p className="suggestion-dialog__original">{original}</p>
            <span className="suggestion-dialog__arrow" aria-hidden>↓</span>
            <p className="suggestion-dialog__translation">{translation}</p>
          </div>
          <div className="suggestion-dialog__actions">
            <button
              className="suggestion-dialog__btn suggestion-dialog__btn--ghost"
              onClick={onReject}
            >
              Rejeitar
            </button>
            <button
              className="suggestion-dialog__btn suggestion-dialog__btn--primary"
              onClick={onAccept}
            >
              Aceitar
            </button>
          </div>
        </>
      )}

      {state === "error" && (
        <>
          <div className="suggestion-dialog__body">
            <p className="suggestion-dialog__error-msg">
              {errorMessage ?? "Erro ao traduzir. Tente novamente."}
            </p>
          </div>
          <div className="suggestion-dialog__actions">
            <button
              className="suggestion-dialog__btn suggestion-dialog__btn--ghost"
              onClick={onReject}
            >
              Fechar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

---

## Passo 3 — CSS em `overlay.css`

Adicionar ao final do arquivo existente (não substituir estilos existentes):

```css
/* ── Overlay expandido (dialog aberto) ─────────────────────────────────────── */

.overlay-root {
  /* Permite crescer além de 48×48 */
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
}

.overlay--expanded {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 8px;
  width: 360px;
}

/* ── Ícone do estado "available" no FloatingButton ──────────────────────────── */

.floating-btn--available {
  /* Usa a mesma base do floating-btn idle, mas com ícone de seta */
  background-color: var(--color-accent-bg);
  color: var(--color-accent-text);
  cursor: pointer;
}

.floating-btn--available::after {
  content: "→";
  font-family: var(--font-sans);
  font-size: 18px;
  line-height: 1;
}

/* ── SuggestionDialog ────────────────────────────────────────────────────────── */

.suggestion-dialog {
  width: 304px;
  min-height: 140px;
  background-color: var(--color-surface-primary);
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* Sem box-shadow — design system Lexio proíbe */
}

.suggestion-dialog__loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.suggestion-dialog__spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border-subtle);
  border-top-color: var(--color-accent-bg);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.suggestion-dialog__body {
  padding: 16px 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.suggestion-dialog__original {
  font-family: var(--font-serif);
  font-size: 13px;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.5;
  /* Truncar em 3 linhas */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.suggestion-dialog__arrow {
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--color-text-muted);
  text-align: center;
  line-height: 1;
}

.suggestion-dialog__translation {
  font-family: var(--font-serif);
  font-size: 13px;
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.suggestion-dialog__error-msg {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-text-muted);
  margin: 0;
}

.suggestion-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 12px 12px;
  border-top: 1px solid var(--color-border-subtle);
}

.suggestion-dialog__btn {
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  padding: 5px 12px;
  border-radius: 4px;
  cursor: pointer;
  border: none;
  line-height: 1;
}

.suggestion-dialog__btn--primary {
  background-color: var(--color-accent-bg);
  color: var(--color-accent-text);
}

.suggestion-dialog__btn--ghost {
  background-color: transparent;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border-subtle);
}
```

---

## Passo 4 — Atualizar `FloatingButton.tsx`

Adicionar a variante visual `available` e a renderização condicional do dialog.
O componente **ainda não tem lógica de hook** — recebe `suggestionState` como prop por ora.

```tsx
// src/renderer/components/FloatingButton.tsx
// Modificações sobre o arquivo existente:

import type { InlineSuggestionState } from "../../types";
import { SuggestionDialog } from "./SuggestionDialog";

// Adicionar à interface de props do componente:
interface FloatingButtonProps {
  // ... props existentes ...
  suggestionState: InlineSuggestionState;
  suggestionOriginal: string;
  suggestionTranslation: string | null;
  suggestionError: string | null;
  onSuggestionAccept: () => void;
  onSuggestionReject: () => void;
}
```

No JSX do componente, modificar a classe do botão para incluir `--available`:

```tsx
// Dentro do return do FloatingButton:

const isDialogOpen =
  suggestionState === "loading" ||
  suggestionState === "ready" ||
  suggestionState === "error";

return (
  <div className={isDialogOpen ? "overlay--expanded" : ""}>
    <button
      className={[
        "floating-btn",
        suggestionState === "available" ? "floating-btn--available" : "",
        // ... classes existentes baseadas em estado idle/loading/success/error ...
      ].filter(Boolean).join(" ")}
      // Arrastar só em idle:
      onMouseDown={suggestionState === "idle" ? handleMouseDown : undefined}
      onClick={suggestionState === "available" ? onBubbleClick : undefined}
    >
      {/* Ícone existente — substituído visualmente pelo CSS no estado available */}
    </button>

    {isDialogOpen && (
      <SuggestionDialog
        state={suggestionState as "loading" | "ready" | "error"}
        original={suggestionOriginal}
        translation={suggestionTranslation}
        errorMessage={suggestionError}
        onAccept={onSuggestionAccept}
        onReject={onSuggestionReject}
      />
    )}
  </div>
);
```

**Nota:** O handler `onBubbleClick` é passado como prop por ora. Na Fase 4, virá do `useInlineSuggestion`.

---

## Passo 5 — Atualizar `overlay-main.tsx`

Garantir que o container não trava em 48px:

```tsx
// src/renderer/overlay-main.tsx

import React from "react";
import ReactDOM from "react-dom/client";
import { FloatingButton } from "./components/FloatingButton";
import "./styles/overlay.css";

// Props de placeholder para Fase 2 — serão substituídas pelo hook na Fase 4
ReactDOM.createRoot(document.getElementById("overlay-root")!).render(
  <React.StrictMode>
    <div style={{ width: "100%", height: "100%", overflow: "visible" }}>
      <FloatingButton
        suggestionState="idle"
        suggestionOriginal=""
        suggestionTranslation={null}
        suggestionError={null}
        onSuggestionAccept={() => {}}
        onSuggestionReject={() => {}}
      />
    </div>
  </React.StrictMode>
);
```

---

## Passo 6 — Atualizar `useOverlay.ts`

Adicionar os novos listeners (sem quebrar os existentes):

```typescript
// src/renderer/hooks/useOverlay.ts
// Adicionar ao arquivo existente:

import type { TextSelectedPayload, InlineSuggestionState } from "../../types";

// Dentro do hook useOverlay, adicionar:
// Listener para texto selecionado
listen<TextSelectedPayload>("overlay:text-selected", (event) => {
  setSelectedText(event.payload.text);
  setCursorPos({ x: event.payload.x, y: event.payload.y });
  setSuggestionState("available");
});

// Listener para mudanças de estado da sugestão
listen<InlineSuggestionState>("overlay:suggestion-state", (event) => {
  setSuggestionState(event.payload);
});

// Listener para erros da sugestão (substituindo overlay:error)
listen<string>("overlay:suggestion-error", (event) => {
  setSuggestionError(event.payload);
  setSuggestionState("error");
});
```

---

## Passo 7 — Testes Vitest

Criar `SuggestionDialog.test.tsx` **antes** de validar o componente visualmente:

```tsx
// src/renderer/components/__tests__/SuggestionDialog.test.tsx

import { render, screen, fireEvent } from "@testing-library/react";
import { SuggestionDialog } from "../SuggestionDialog";

describe("SuggestionDialog", () => {
  it("mostra spinner no estado loading", () => {
    render(
      <SuggestionDialog
        state="loading"
        original="Olá mundo"
        translation={null}
        errorMessage={null}
        onAccept={() => {}}
        onReject={() => {}}
      />
    );
    expect(screen.getByLabelText("Traduzindo...")).toBeInTheDocument();
  });

  it("mostra original e tradução no estado ready", () => {
    render(
      <SuggestionDialog
        state="ready"
        original="Olá mundo"
        translation="Hello world"
        errorMessage={null}
        onAccept={() => {}}
        onReject={() => {}}
      />
    );
    expect(screen.getByText("Olá mundo")).toBeInTheDocument();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("chama onAccept ao clicar em Aceitar", () => {
    const onAccept = vi.fn();
    render(
      <SuggestionDialog
        state="ready"
        original="Texto"
        translation="Text"
        errorMessage={null}
        onAccept={onAccept}
        onReject={() => {}}
      />
    );
    fireEvent.click(screen.getByText("Aceitar"));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("chama onReject ao clicar em Rejeitar", () => {
    const onReject = vi.fn();
    render(
      <SuggestionDialog
        state="ready"
        original="Texto"
        translation="Text"
        errorMessage={null}
        onAccept={() => {}}
        onReject={onReject}
      />
    );
    fireEvent.click(screen.getByText("Rejeitar"));
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it("mostra mensagem de erro no estado error", () => {
    render(
      <SuggestionDialog
        state="error"
        original=""
        translation={null}
        errorMessage="Falha na conexão"
        onAccept={() => {}}
        onReject={() => {}}
      />
    );
    expect(screen.getByText("Falha na conexão")).toBeInTheDocument();
    expect(screen.getByText("Fechar")).toBeInTheDocument();
  });
});
```

---

## Verificação da Fase 2

```bash
npm test              # SuggestionDialog.test.tsx deve passar
npm run build:renderer # zero erros, zero warnings
```

### Checklist de saída

- [ ] `SuggestionDialog.tsx` criado, ≤ 150 linhas
- [ ] `SuggestionDialog.test.tsx` criado com todos os testes passando (≥ 5 testes)
- [ ] `overlay.css` com todas as classes novas (sem box-shadow, sem gradientes)
- [ ] `FloatingButton.tsx` com variante visual `available` e modo dialog
- [ ] `overlay-main.tsx` sem altura travada no container
- [ ] `useOverlay.ts` com listeners dos novos eventos
- [ ] `src/types/index.ts` com `InlineSuggestionState`, `TextSelectedPayload`, `SuggestionResponse`
- [ ] Zero `any` em TypeScript
- [ ] Zero cores hardcoded em JSX/CSS
- [ ] `npm run build:renderer` limpo
- [ ] **Inspeção visual:** abrir `npm run dev:renderer` e verificar que o dialog aparece corretamente com props fixas (`state="ready"`, `original="Eu preciso melhorar..."`, `translation="I need to improve..."`)

---

## Arquivos Criados nesta Fase

- `src/renderer/components/SuggestionDialog.tsx`
- `src/renderer/components/__tests__/SuggestionDialog.test.tsx`

## Arquivos Modificados nesta Fase

- `src/renderer/components/FloatingButton.tsx`
- `src/renderer/hooks/useOverlay.ts`
- `src/renderer/overlay-main.tsx`
- `src/renderer/styles/overlay.css`
- `src/types/index.ts`
