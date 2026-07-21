# Manual Testing — Lexio Assistant

**Branch:** `feat/inline-translation-refactor`  
**Atalhos:**

| Atalho | Função |
|---|---|
| `Ctrl+Alt+E` | Toggle janela principal (dicionário) |
| `Ctrl+Alt+T` | Traduzir seleção (assistente) |

---

## Pré-requisitos

1. Worktree: `.worktrees/feat-inline-translation-refactor`
2. `npm run dev` (Tauri)
3. Chave API configurada em Configurações (Gemini/Groq) **ou** Ollama local
4. Notepad (ou app com TextPattern UIA)

---

## Checklist

### Happy path
- [ ] Selecionar texto em **português** no Notepad
- [ ] Premir `Ctrl+Alt+T`
- [ ] Janela assistente abre (visual Lexio shell, com blur suave)
- [ ] Mostra loading → tradução
- [ ] **Ícone Copiar** (header, azul) copia e muda para check ~2s
- [ ] **×** / ícone fechar (ou ESC) esconde a janela
- [ ] Ícone **info** mostra texto informativo (modo + limite de cobertura)

### Sem seleção
- [ ] Sem texto selecionado → `Ctrl+Alt+T`
- [ ] Mensagem: selecione texto primeiro
- [ ] Fechar funciona

### Inglês
- [ ] Selecionar frase longa em inglês → `Ctrl+Alt+T`
- [ ] Mensagem: texto em inglês detectado (não traduz)

### Isolamento da main
- [ ] Abrir dicionário (`Ctrl+Alt+E`), buscar uma palavra
- [ ] Em paralelo, traduzir seleção com `Ctrl+Alt+T`
- [ ] Janela main **não** perde o resultado da busca

### Apps sem UIA
- [ ] Terminal / app sem TextPattern → `Ctrl+Alt+T`
- [ ] Comportamento: no-selection (silent fail de UIA)

### Clipboard
- [ ] Copiar algo para o clipboard antes
- [ ] Traduzir seleção (UIA — clipboard do utilizador **não** deve ser usado na captura)
- [ ] Após **Copiar** no assistente, clipboard = tradução

---

## O que NÃO testar (removido)

- Bubble flutuante / drag para selecionar
- Aceitar / inject no campo fonte
- Overlay `Ctrl+Alt+O`
