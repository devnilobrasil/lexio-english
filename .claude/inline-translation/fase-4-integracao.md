# Fase 4 — Integração End-to-End

**Objetivo:** Conectar backend e frontend em fluxo completo — seleção de texto → bubble muda de estado → clique → dialog com tradução → aceitar/rejeitar. Criar o hook `useInlineSuggestion`, integrar com `FloatingButton`, e conectar o resize da janela overlay. Ao final desta fase, o fluxo completo funciona manualmente.

**Referência:** `SPEC.md` — Seções 3 (UX Flow), 4 (Arquitetura de janelas), 7 (IPC), 8 (Frontend), 11 (Testes)

---

## Skills e Modelo

**Modelo recomendado:** `claude-opus-4-6`
Esta fase tem o maior risco de integração: foco de janela, resize dinâmico via Tauri, e a sequência timing-sensitive de inject_text antes do foco mudar. Usar Opus.

**Ler antes de implementar:**

| Skill | Por quê |
|---|---|
| `.claude/skills/tauri-architecture/SKILL.md` | `window.setSize()`, `window.setFocus()`, `invoke()` e `listen()` no renderer |
| `.claude/skills/lexio-testing/SKILL.md` | Como mockar eventos Tauri em Vitest, estrutura de testes E2E |
| `superpowers:systematic-debugging` | O fluxo tem 10 etapas sequenciais — usar quando timing ou foco gerarem comportamento inesperado |

---

## Pré-requisitos

- Fases 1, 2 e 3 concluídas (todos os critérios de saída verificados)
- `cargo build` passando
- `npm test` passando

---

## Estrutura de Arquivos desta Fase

```
src/renderer/
├── hooks/
│   ├── useInlineSuggestion.ts   ← NOVO
│   └── useOverlay.ts            ← MODIFICAR: conectar ao hook novo
├── components/
│   └── FloatingButton.tsx       ← MODIFICAR: usar useInlineSuggestion
└── overlay-main.tsx             ← MODIFICAR: remover props placeholder da Fase 2

src/tauri/src/
└── commands/
    └── suggestion.rs            ← MODIFICAR: adicionar resize da janela no accept/dismiss
```

---

## Passo 1 — `useInlineSuggestion.ts`

```typescript
// src/renderer/hooks/useInlineSuggestion.ts

import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type {
  InlineSuggestionState,
  TextSelectedPayload,
  SuggestionResponse,
} from "../../types";

const AVAILABLE_TIMEOUT_MS = 6_000;  // 6s sem clicar → volta ao idle
const READY_TIMEOUT_MS = 30_000;     // 30s sem interagir → fecha dialog

export function useInlineSuggestion() {
  const [state, setState] = useState<InlineSuggestionState>("idle");
  const [original, setOriginal] = useState<string>("");
  const [translation, setTranslation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const availableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Utilitários de timer ────────────────────────────────────────────────

  const clearAvailableTimer = () => {
    if (availableTimerRef.current) clearTimeout(availableTimerRef.current);
  };

  const clearReadyTimer = () => {
    if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
  };

  // ── Transição para idle: limpa tudo ────────────────────────────────────

  const goIdle = useCallback(() => {
    clearAvailableTimer();
    clearReadyTimer();
    setState("idle");
    setOriginal("");
    setTranslation(null);
    setError(null);
  }, []);

  // ── Resize da janela overlay ────────────────────────────────────────────

  const resizeWindow = useCallback(async (width: number, height: number) => {
    try {
      const win = getCurrentWindow();
      await win.setSize({ type: "Physical", width, height });
    } catch (e) {
      console.error("[useInlineSuggestion] failed to resize window:", e);
    }
  }, []);

  // ── Listeners de eventos Rust → frontend ───────────────────────────────

  useEffect(() => {
    const unlisteners: Array<() => void> = [];

    // Texto selecionado: transição para "available"
    listen<TextSelectedPayload>("overlay:text-selected", async (event) => {
      clearAvailableTimer();
      clearReadyTimer();
      setOriginal(event.payload.text);
      setTranslation(null);
      setError(null);
      setState("available");

      // Reposicionar a janela perto do cursor
      try {
        const win = getCurrentWindow();
        await win.setPosition({
          type: "Physical",
          x: event.payload.x + 12,
          y: event.payload.y + 12,
        });
      } catch (e) {
        console.error("[useInlineSuggestion] failed to set position:", e);
      }

      // Timeout: se o usuário ignorar o ícone por 6s, volta ao idle
      availableTimerRef.current = setTimeout(goIdle, AVAILABLE_TIMEOUT_MS);
    }).then((fn) => unlisteners.push(fn));

    // Mudança de estado vinda do Rust
    listen<InlineSuggestionState>("overlay:suggestion-state", (event) => {
      const newState = event.payload;
      setState(newState);
      if (newState === "idle") {
        goIdle();
      }
    }).then((fn) => unlisteners.push(fn));

    // Erro vindo do Rust
    listen<string>("overlay:suggestion-error", (event) => {
      setError(event.payload);
      setState("error");
    }).then((fn) => unlisteners.push(fn));

    return () => unlisteners.forEach((fn) => fn());
  }, [goIdle]);

  // ── ESC para rejeitar quando dialog está aberto ─────────────────────────

  useEffect(() => {
    const isDialogOpen =
      state === "loading" || state === "ready" || state === "error";
    if (!isDialogOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleReject();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state]);

  // ── Ações ───────────────────────────────────────────────────────────────

  const handleBubbleClick = useCallback(async () => {
    if (state !== "available") return;
    clearAvailableTimer();

    // Expandir janela para mostrar o dialog
    await resizeWindow(360, 180);

    // Dar foco à janela para capturar ESC e cliques
    try {
      const win = getCurrentWindow();
      await win.setFocus();
    } catch (e) {
      console.error("[useInlineSuggestion] failed to set focus:", e);
    }

    try {
      const response = await invoke<SuggestionResponse>("suggestion_request");
      setTranslation(response.translation);
      setOriginal(response.original);
      setState("ready");

      // Timeout: fecha o dialog após 30s de inatividade
      readyTimerRef.current = setTimeout(handleReject, READY_TIMEOUT_MS);
    } catch (e) {
      setError(typeof e === "string" ? e : "Erro ao traduzir");
      setState("error");
    }
  }, [state, resizeWindow]);

  const handleAccept = useCallback(async () => {
    if (!translation) return;
    clearReadyTimer();

    try {
      await invoke("suggestion_accept", { text: translation });
      // O Rust emite overlay:suggestion-state=idle → goIdle() será chamado via listener
    } catch (e) {
      setError(typeof e === "string" ? e : "Erro ao aceitar");
      setState("error");
    }

    // Encolher janela de volta para 48×48
    await resizeWindow(48, 48);
  }, [translation, resizeWindow]);

  const handleReject = useCallback(async () => {
    clearReadyTimer();

    try {
      await invoke("suggestion_dismiss");
    } catch (e) {
      console.error("[useInlineSuggestion] dismiss error:", e);
    }

    // Encolher janela de volta para 48×48
    await resizeWindow(48, 48);
    goIdle();
  }, [resizeWindow, goIdle]);

  return {
    state,
    original,
    translation,
    error,
    handleBubbleClick,
    handleAccept,
    handleReject,
  };
}
```

---

## Passo 2 — Integrar hook em `overlay-main.tsx`

Substituir os props placeholder da Fase 2:

```tsx
// src/renderer/overlay-main.tsx

import React from "react";
import ReactDOM from "react-dom/client";
import { FloatingButton } from "./components/FloatingButton";
import { useInlineSuggestion } from "./hooks/useInlineSuggestion";
import "./styles/overlay.css";

function OverlayApp() {
  const {
    state,
    original,
    translation,
    error,
    handleBubbleClick,
    handleAccept,
    handleReject,
  } = useInlineSuggestion();

  return (
    <FloatingButton
      suggestionState={state}
      suggestionOriginal={original}
      suggestionTranslation={translation}
      suggestionError={error}
      onBubbleClick={handleBubbleClick}
      onSuggestionAccept={handleAccept}
      onSuggestionReject={handleReject}
    />
  );
}

ReactDOM.createRoot(document.getElementById("overlay-root")!).render(
  <React.StrictMode>
    <OverlayApp />
  </React.StrictMode>
);
```

---

## Passo 3 — Atualizar `FloatingButton.tsx`

Substituir props placeholder por `onBubbleClick`:

```tsx
// Atualizar interface de props para incluir:
interface FloatingButtonProps {
  // ... props existentes ...
  onBubbleClick: () => void;
  // ... demais novas props ...
}

// O click do bubble agora usa onBubbleClick:
onClick={suggestionState === "available" ? onBubbleClick : undefined}
```

---

## Passo 4 — Testes Vitest para `useInlineSuggestion`

```typescript
// src/renderer/hooks/__tests__/useInlineSuggestion.test.ts

import { renderHook, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useInlineSuggestion } from "../useInlineSuggestion";

// Mock @tauri-apps/api
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn().mockReturnValue({
    setSize: vi.fn().mockResolvedValue(undefined),
    setPosition: vi.fn().mockResolvedValue(undefined),
    setFocus: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { invoke } from "@tauri-apps/api/core";

describe("useInlineSuggestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inicia no estado idle", () => {
    const { result } = renderHook(() => useInlineSuggestion());
    expect(result.current.state).toBe("idle");
  });

  it("handleBubbleClick não faz nada se não estiver em available", async () => {
    const { result } = renderHook(() => useInlineSuggestion());
    // state = "idle" — clique não deve invocar nada
    await act(() => result.current.handleBubbleClick());
    expect(invoke).not.toHaveBeenCalled();
  });

  it("handleAccept invoca suggestion_accept com o texto da tradução", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const { result } = renderHook(() => useInlineSuggestion());

    // Forçar estado para "ready" com tradução
    act(() => {
      // Simular que veio uma tradução — via setState interno não é possível diretamente
      // Testar via invoke mock
    });

    // Verificar que suggestion_accept é chamado com o texto correto
    // (teste completo depende de simular o fluxo via listen mocks)
  });

  it("handleReject invoca suggestion_dismiss", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const { result } = renderHook(() => useInlineSuggestion());
    await act(() => result.current.handleReject());
    expect(invoke).toHaveBeenCalledWith("suggestion_dismiss");
  });
});
```

---

## Passo 5 — Teste E2E com Playwright

Ver `.claude/skills/lexio-testing/SKILL.md` para configuração base.

```typescript
// e2e/inline-translation.spec.ts

import { test, expect } from "@playwright/test";
import { _electron as electron } from "playwright";

test.describe("Inline Translation", () => {
  test("bubble aparece e dialog abre ao clicar", async () => {
    // Mockar Gemini — nunca chamar API real
    // (ver lexio-testing/SKILL.md para padrão de mock)

    // 1. Iniciar o app Electron/Tauri
    // 2. Simular o evento overlay:text-selected via invoke especial de teste
    // 3. Verificar que o bubble muda para estado "available"
    // 4. Clicar no bubble
    // 5. Verificar que o dialog abre com original + tradução
    // 6. Clicar "Aceitar"
    // 7. Verificar que o dialog fecha (janela volta a 48×48)
  });

  test("rejeitar não modifica nada", async () => {
    // Similar ao anterior, mas clica em "Rejeitar"
    // Verificar que nenhum invoke('suggestion_accept') foi chamado
  });

  test("ESC fecha o dialog", async () => {
    // Abrir dialog → pressionar ESC → verificar idle
  });
});
```

**Nota:** O hook global de mouse (`selection_watcher`) **não é testado em E2E**. Simular o evento `overlay:text-selected` diretamente via Tauri IPC para testar o fluxo a partir desse ponto.

---

## Verificação da Fase 4

```bash
npm test              # useInlineSuggestion.test.ts + SuggestionDialog.test.tsx passando
npm run build:renderer # zero erros
cargo build           # zero erros
```

### Checklist de saída

- [ ] `useInlineSuggestion.ts` criado, ≤ 150 linhas
- [ ] `useInlineSuggestion.test.ts` criado com testes passando
- [ ] `overlay-main.tsx` usando o hook (sem props placeholder)
- [ ] `FloatingButton.tsx` usando `onBubbleClick` do hook
- [ ] **Teste manual — fluxo feliz:**
  - [ ] Selecionar texto em português no Notepad
  - [ ] Bubble reposiciona próximo ao cursor e muda para estado `available`
  - [ ] Clicar no bubble → dialog abre com spinner
  - [ ] Tradução aparece no dialog
  - [ ] Clicar "Aceitar" → texto é substituído no Notepad
  - [ ] Dialog fecha, bubble volta ao estado idle
- [ ] **Teste manual — rejeição:**
  - [ ] Selecionar texto → bubble available → clicar → dialog abre
  - [ ] Clicar "Rejeitar" → dialog fecha, texto original intocado
- [ ] **Teste manual — ESC:**
  - [ ] Dialog aberto → pressionar ESC → dialog fecha
- [ ] **Teste manual — gate de idioma:**
  - [ ] Selecionar texto em inglês → bubble NÃO muda para `available`
- [ ] `npm run build:renderer` limpo
- [ ] Zero `any` em TypeScript

---

## Arquivos Criados nesta Fase

- `src/renderer/hooks/useInlineSuggestion.ts`
- `src/renderer/hooks/__tests__/useInlineSuggestion.test.ts`
- `e2e/inline-translation.spec.ts`

## Arquivos Modificados nesta Fase

- `src/renderer/overlay-main.tsx`
- `src/renderer/components/FloatingButton.tsx`
