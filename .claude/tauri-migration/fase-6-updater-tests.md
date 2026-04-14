# Fase 6 — Auto-updater, Testes e Build Final

**Objetivo:** Integrar o sistema de atualização automática, adaptar os testes Vitest para Tauri (mockIPC), validar o build de produção completo, e executar o checklist de paridade funcional.

**Referência:** `SPEC.md` — Seções 10, 12 e 15

---

## Skills e Modelo

**Modelo recomendado:** `claude-sonnet-4-6` para testes Vitest + limpeza. `claude-opus-4-6` se o auto-updater ou a configuração de signing apresentarem problemas.

**Ler antes de implementar:**

| Skill | Por quê |
|---|---|
| `.claude/skills/tauri-build-deploy/SKILL.md` | Bundle config, `tauri signer generate`, `latest.json`, GitHub Actions |
| `.claude/skills/lexio-testing/SKILL.md` | Base Vitest — adaptar para `mockIPC` de `@tauri-apps/api/mocks` |
| `superpowers:test-driven-development` | Escrever testes de hooks com `mockIPC` antes de validar manualmente |
| `superpowers:finishing-a-development-branch` | Checklist final antes do PR: limpeza, commit, PR para `stage` |
| `superpowers:verification-before-completion` | Executar o checklist de paridade funcional (27 itens) antes de fechar |
| `.claude/skills/git-workflow/SKILL.md` | PR para `stage` com description das mudanças arquiteturais |

---

## Pré-requisitos

- Fases 1–5 concluídas
- Todas as funcionalidades verificadas manualmente

---

## Parte A — Auto-updater

### Dependência

```toml
# Cargo.toml
tauri-plugin-updater = "2"
```

```json
// tauri.conf.json — adicionar em plugins
{
  "plugins": {
    "global-shortcut": {},
    "updater": {
      "pubkey": "COLOCA_AQUI_SUA_CHAVE_PUBLICA",
      "endpoints": [
        "https://github.com/devnilobrasil/lexio/releases/latest/download/latest.json"
      ]
    }
  }
}
```

A chave pública é gerada com `tauri signer generate`. A chave privada fica em variável de ambiente no CI (`TAURI_SIGNING_PRIVATE_KEY`).

### Estrutura

```
src/tauri/src/
└── updater.rs    ← NOVO
```

### `src/tauri/src/updater.rs`

```rust
use tauri::{AppHandle, Manager};
use tauri_plugin_updater::UpdaterExt;

pub async fn check_and_setup(app: AppHandle) {
    // Só verificar em produção (app empacotado)
    if !app.is_packaged() { return; }

    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => {
            eprintln!("[updater] failed to get updater: {}", e);
            return;
        }
    };

    let update = match updater.check().await {
        Ok(Some(u)) => u,
        Ok(None)    => return,  // sem atualização
        Err(e)      => {
            eprintln!("[updater] check error: {}", e);
            return;
        }
    };

    // Notificar renderer: update disponível
    app.emit_to("main", "update:available", &update.version).ok();

    // Baixar com progresso
    let app_download = app.clone();
    update.download_and_install(
        move |chunk_len, content_len| {
            if let Some(total) = content_len {
                let pct = (chunk_len as f64 / total as f64 * 100.0).round() as u32;
                app_download.emit_to("main", "update:progress", pct).ok();
            }
        },
        move || {
            app.emit_to("main", "update:downloaded", "").ok();
        },
    ).await.ok();
}
```

### Command para instalar

```rust
// src/tauri/src/commands/window.rs — adicionar
#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    // Em Tauri v2, restart + install é feito pelo plugin
    app.restart();
    Ok(())
}
```

### Registrar no `main.rs`

```rust
.plugin(tauri_plugin_updater::Builder::new().build())
.setup(|app| {
    // ... setup existente ...

    // Auto-updater (async, em background)
    let app_handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        updater::check_and_setup(app_handle).await;
    });

    Ok(())
})
// Adicionar no invoke_handler:
// commands::window::install_update,
```

### Adaptar `useAutoUpdater.ts` no frontend

```ts
import { listen } from '@tauri-apps/api/event'
import { invoke } from '../lib/tauri-bridge'

export function useAutoUpdater() {
  const [updateVersion, setUpdateVersion] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const [downloaded, setDownloaded] = useState(false)

  useEffect(() => {
    const listeners = [
      listen<string>('update:available',  (e) => setUpdateVersion(e.payload)),
      listen<number>('update:progress',   (e) => setProgress(e.payload)),
      listen<string>('update:downloaded', ()  => setDownloaded(true)),
    ]
    return () => { listeners.forEach(p => p.then(fn => fn())) }
  }, [])

  const install = () => invoke('install_update')

  return { updateVersion, progress, downloaded, install }
}
```

Deletar `src/preload/index.ts` — não é mais necessário. Deletar toda referência a `ipcRenderer`.

---

## Parte B — Testes Vitest com mockIPC

### Instalar dependências de teste

```bash
npm install -D @tauri-apps/api vitest @testing-library/react
```

### Configurar mock global (`src/renderer/test/setup.ts`)

```ts
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks'

beforeEach(() => {
  // Mock padrão para get_api_key (a maioria dos testes precisa disso)
  mockIPC((cmd, args) => {
    if (cmd === 'get_api_key') return null
    if (cmd === 'get_history') return []
    if (cmd === 'get_saved')   return []
  })
})

afterEach(() => {
  clearMocks()
})
```

### Configurar `vite.config.ts` para testes

```ts
export default defineConfig({
  // ... config existente ...
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/renderer/test/setup.ts'],
  },
})
```

### Exemplo de teste de hook (`useSearch.test.ts`)

```ts
import { renderHook, act } from '@testing-library/react'
import { mockIPC } from '@tauri-apps/api/mocks'
import { useSearch } from '../hooks/useSearch'
import type { Word } from '../../types'

const mockWord: Word = {
  word: 'churn',
  phonetic: '/tʃɜːrn/',
  pos: 'verb',
  level: 'Advanced',
  verb_forms: null,
  meanings: [],
  synonyms: ['agitate'],
  antonyms: [],
  contexts: ['Business'],
}

describe('useSearch', () => {
  it('returns word from cache (get_word returns immediately)', async () => {
    mockIPC((cmd) => {
      if (cmd === 'get_word') return mockWord
    })

    const { result } = renderHook(() => useSearch())

    await act(async () => {
      await result.current.search('churn', 'pt-BR')
    })

    expect(result.current.word).toEqual(mockWord)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('shows loading state during search', async () => {
    let resolve: (v: Word) => void
    const pending = new Promise<Word>(r => { resolve = r })

    mockIPC((cmd) => {
      if (cmd === 'get_word') return pending
    })

    const { result } = renderHook(() => useSearch())

    act(() => { result.current.search('churn', 'pt-BR') })
    expect(result.current.loading).toBe(true)

    await act(async () => { resolve!(mockWord) })
    expect(result.current.loading).toBe(false)
  })

  it('sets error state when get_word throws', async () => {
    mockIPC((cmd) => {
      if (cmd === 'get_word') throw new Error('API key not configured')
    })

    const { result } = renderHook(() => useSearch())

    await act(async () => {
      await result.current.search('churn', 'pt-BR')
    })

    expect(result.current.error).toContain('API key')
    expect(result.current.word).toBeNull()
  })
})
```

### Testes de DB (já cobertos na Fase 2 via `cargo test`)

Os testes Rust de DB são mantidos e expandidos se necessário.

---

## Parte C — Build de Produção

### Pré-build checklist

```bash
# 1. TypeScript sem erros
npm run build:renderer

# 2. Testes passando
npm run test
cd src/tauri && cargo test && cd ../..

# 3. Build Tauri
npm run build
```

### Configurar assinatura para Windows

```json
// tauri.conf.json — bundle
{
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis"],
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": ""
    }
  }
}
```

### `latest.json` para auto-updater

O arquivo `latest.json` deve ser publicado junto com o release no GitHub:

```json
{
  "version": "1.0.0",
  "notes": "Release notes aqui",
  "pub_date": "2026-01-01T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "SIGNATURE_DO_INSTALADOR",
      "url": "https://github.com/devnilobrasil/lexio/releases/download/v1.0.0/lexio_1.0.0_x64-setup.exe"
    }
  }
}
```

---

## Parte D — Limpeza Final

### Arquivos a Deletar (após build de produção passar)

```
_electron_backup/           ← pode deletar agora
src/main/                   ← todo o diretório Electron main
src/preload/index.ts
src/preload/overlay-preload.ts
src/renderer/lib/ai.ts
src/renderer/lib/ai.test.ts
```

### Dependências a Remover de `package.json`

```bash
npm uninstall electron electron-builder electron-updater
npm uninstall @nut-tree-fork/nut-js selection-hook
npm uninstall better-sqlite3 @types/better-sqlite3
```

### Verificar que nenhum import quebrado existe

```bash
npm run build:renderer  # não deve ter erros
```

---

## Checklist de Paridade Funcional

Executar cada item manualmente antes de considerar a migração completa:

### Busca de Palavras
- [ ] Cache hit: buscar palavra já salva → retorna imediatamente, sem chamada Gemini
- [ ] Cache miss: buscar palavra nova → chama Gemini, salva, exibe resultado
- [ ] Palavra em `pt-BR` aparece com significados em português
- [ ] Palavra em `es` aparece com significados em espanhol
- [ ] Locale switch funciona: trocar de pt-BR para es muda os significados exibidos

### Histórico e Salvos
- [ ] Palavras buscadas aparecem no histórico
- [ ] `remove_from_history` remove do histórico sem deletar a palavra
- [ ] `toggle_saved` salva/dessalva uma palavra
- [ ] Aba "Salvos" exibe apenas palavras com `is_saved = 1`
- [ ] `delete_word` remove da lista completamente

### Settings
- [ ] Salvar API key em Settings → persiste após reiniciar
- [ ] API key nunca aparece nos logs do DevTools

### Janela e Atalhos
- [ ] `Ctrl+Alt+E` abre a janela na posição correta
- [ ] `Ctrl+Alt+E` com janela aberta e focada → minimiza
- [ ] `Ctrl+Alt+E` com janela minimizada → restaura
- [ ] Janela expande de 60px para 420px ao receber resultado
- [ ] Janela volta para 60px ao limpar a busca
- [ ] Botão de fechar esconde (não fecha) a janela
- [ ] Sistema de bandeja: Show Lexio, Show/Hide Overlay, Quit

### Overlay e Tradução
- [ ] Overlay aparece como bolha 48×48 always-on-top
- [ ] `Ctrl+Alt+O` mostra/esconde overlay
- [ ] `Ctrl+Alt+T` com texto selecionado → traduz e injeta
- [ ] Overlay exibe loading durante tradução
- [ ] Overlay exibe success após tradução
- [ ] Clipboard do usuário restaurado após injeção
- [ ] Overlay pode ser arrastado
- [ ] Posição do overlay persiste entre reinicializações

### Auto-updater
- [ ] Em produção (app empacotado), verifica atualização ao iniciar
- [ ] Banner de atualização aparece quando nova versão disponível
- [ ] "Install now" reinicia o app com nova versão

### Build
- [ ] `npm run build` completa sem erros
- [ ] Instalador `.exe` funciona em máquina limpa
- [ ] App empacotado não abre DevTools automaticamente
- [ ] Tamanho do instalador < 10MB (Tauri benchmark típico)

---

## Critério de Saída da Fase 6

- [ ] `cargo test` — 0 falhas
- [ ] `npm run test` — 0 falhas
- [ ] `npm run build` — sem erros, instalador gerado
- [ ] Todos os 27 itens do checklist acima marcados
- [ ] Branch `feat/migrate-to-tauri` com PR aberto para `stage`
- [ ] PR description documenta as mudanças arquiteturais principais
