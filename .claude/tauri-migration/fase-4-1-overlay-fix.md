# Fase 4.1 — Overlay Fix: Image Render + Drag-and-Drop

**Objetivo:** Corrigir dois bugs descobertos após a Fase 4: o overlay não renderizava a imagem e o drag-and-drop não funcionava.

**Referência:** Fase 4 — `fase-4-windows-shortcuts-tray.md`

---

## Causa Raiz

`FloatingButton.tsx` dependia de `window.lexioOverlay.*` — uma API exposta via `contextBridge` do Electron no `overlay-preload.ts`. No Tauri não existe preload/contextBridge, portanto `window.lexioOverlay` era `undefined` em runtime. O `useEffect` de registro de eventos crashava silenciosamente no mount, impedindo a renderização do componente. Além disso, não havia nenhum command Rust para mover a janela overlay via IPC.

---

## Pré-requisitos

- Fase 4 concluída (janelas, atalhos e tray funcionando)

---

## Estrutura de Arquivos

```
src/tauri/src/
└── commands/
    └── window.rs      ← ATUALIZAR: adicionar overlay_set_position, overlay_drag_start
src/renderer/
├── hooks/
│   └── useOverlay.ts  ← NOVO: substitui window.lexioOverlay.*
└── components/
    └── FloatingButton.tsx ← ATUALIZAR: usar useOverlay hook
```

---

## Passo 1 — Rust: Commands de Overlay (`commands/window.rs`)

```rust
#[tauri::command]
pub fn overlay_set_position(x: i32, y: i32, app: AppHandle) {
    if let Some(overlay) = app.get_webview_window("overlay") {
        overlay.set_position(tauri::PhysicalPosition { x, y }).ok();
    }
}

#[tauri::command]
pub fn overlay_drag_start() {
    // no-op — drag state é gerenciado no renderer
}
```

Teste unitário:
```rust
#[test]
fn test_overlay_drag_start_is_noop() {
    super::overlay_drag_start();
}
```

---

## Passo 2 — Registrar em `main.rs`

```rust
commands::window::overlay_set_position,
commands::window::overlay_drag_start,
```

---

## Passo 3 — Hook `useOverlay.ts`

```ts
import { useState, useEffect } from 'react'
import type { OverlayState } from '../../types'
import { invoke, listen } from '../lib/tauri-bridge'

export function useOverlay() {
  const [state, setState] = useState<OverlayState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const unlisteners = Promise.all([
      listen<OverlayState>('overlay:state', (e) => setState(e.payload)),
      listen<string>('overlay:error', (e) => setErrorMsg(e.payload)),
    ])
    return () => { unlisteners.then((fns) => fns.forEach((fn) => fn())) }
  }, [])

  return {
    state,
    errorMsg,
    translate: () => invoke<void>('overlay_translate'), // stub — Fase 5
    dragStart: () => invoke<void>('overlay_drag_start'),
    setPosition: (x: number, y: number) => invoke<void>('overlay_set_position', { x, y }),
  }
}
```

---

## Passo 4 — Atualizar `FloatingButton.tsx`

Remover todas as referências a `window.lexioOverlay.*` e usar o hook:

```tsx
import { useOverlay } from '../hooks/useOverlay'

export default function FloatingButton() {
  const { state, errorMsg, translate, dragStart, setPosition } = useOverlay()
  // ... lógica de drag inalterada, apenas swapear window.lexioOverlay.* pelas funções do hook
}
```

---

## Critério de Saída

| Critério | Resultado |
|---|---|
| `cargo test` passa (incluindo `test_overlay_drag_start_is_noop`) | ⏳ Verificar manualmente |
| `npm run build:renderer` passa sem erros | ✅ Zero erros |
| Overlay renderiza ícone Lexio | ⏳ Verificar com `npm run dev` |
| Drag-and-drop move o overlay | ⏳ Verificar com `npm run dev` |
| Sem `window.lexioOverlay` no renderer | ✅ Confirmado via grep |

---

## Fora do Escopo (Fase 5)

- `overlay_translate` command Rust — requer captura de clipboard + injeção de teclado
- Persistência de posição do overlay (salvar/carregar do disco)
- Atalho global `Ctrl+Alt+T` para tradução

---

## Decisões

1. **`translate()` como stub** — O botão renderiza e o drag funciona. Double-click tenta `invoke('overlay_translate')` que falha silenciosamente (command não existe ainda). Aceitável para este fix.

2. **`overlay_drag_start` é no-op** — No Electron também era vazio. Mantido por paridade de API e para facilitar debug futuro caso seja necessário adicionar lógica.

3. **Sem mudanças em `tauri.conf.json`** — A janela overlay já estava configurada corretamente (48×48, transparent, alwaysOnTop, focusable:false via `focus: false`).
