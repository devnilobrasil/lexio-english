---
name: lexio-design-system
description: Tokens de cor, tipografia, espaçamento e regras visuais do Lexio. Consultar SEMPRE antes de escrever qualquer CSS ou JSX com classes Tailwind. O design é editorial (dicionário refinado), não tecnológico (dashboard SaaS).
---

# Lexio Design System Skill

> Referência completa em `LEXIO_DESIGN_SYSTEM.md` na raiz do projeto.  
> Esta skill cobre as regras mais críticas para uso diário.

---

## Princípios Invioláveis

1. **Editorial, não tecnológico** — Parece um dicionário refinado, não um dashboard SaaS
2. **Uma cor de acento** — Azul apenas em badges de contexto e estados interativos. Não decorativo
3. **Sem sombras, sem gradientes** — Hierarquia via cor de superfície e bordas finas
4. **Tipografia com carácter** — Lora (serif) para conteúdo lexicográfico, Inter (sans) para chrome

---

## Tokens de Cor

### Superfícies (do mais escuro ao mais claro)

```
surface-sunken  #F0EEE9  → titlebar, nav, statusbar
surface-base    #F7F6F3  → fundo principal do app
surface-raised  #FFFFFF  → input, elementos interativos
surface-hover   #ECEAE4  → hover em items de lista
```

### Bordas

```
border-subtle   #E2E0DA  → bordas gerais, divisores de secção
border-muted    #ECEAE4  → divisores internos (entre exemplos)
```

### Texto (do mais escuro ao mais suave)

```
text-primary    #1A1918  → palavra, significado PT, corpo principal
text-secondary  #2C2C2A  → exemplos em inglês
text-muted      #888780  → fonética, pos, traduções, placeholders
text-faint      #B4B2A9  → labels uppercase, status bar, kbd hint
```

### Acento — Azul (usar com parcimônia)

```
accent-bg       #E6F1FB  → fundo de badge de contexto
accent-text     #0C447C  → texto de badge de contexto
```

### Tags neutras (sinónimos)

```
tag-bg          #ECEAE4  → fundo de tag neutra
tag-text        #5F5E5A  → texto de tag neutra
```

---

## Tipografia

### Duas famílias, papéis opostos. NUNCA misturar no mesmo elemento.

| Família | Papel | Quando usar |
|---|---|---|
| `Lora` (serif) | Conteúdo lexicográfico | Palavra, significado PT, significado EN, fonética |
| `Inter` (sans) | Chrome do app | Nav, labels, badges, placeholders, status bar, exemplos |

### Escala Tipográfica

| Elemento | Família | Size | Peso | Cor |
|---|---|---|---|---|
| Palavra principal | Lora | 42px | 600 | `#1A1918` |
| Significado PT | Lora | 17px | 400 | `#1A1918` |
| Significado EN | Lora italic | 13px | 400 | `#888780` |
| Exemplo EN | Inter | 13px | 400 | `#2C2C2A` |
| Exemplo PT | Inter | 12px | 400 | `#888780` |
| Label de secção | Inter | 10px | 500 | `#B4B2A9` |
| Nav item | Inter | 12px | 500 | `#888780` / `#2C2C2A` |
| Badge / tag | Inter | 10–11px | 500 | variável |
| Placeholder input | Inter | 14px | 400 | `#B4B2A9` |
| Status bar | Inter | 10px | 400 | `#B4B2A9` |

### Regras Tipográficas

- Labels de secção: sempre `uppercase` com `letter-spacing: 1.2px`
- Fonética: `font-style: italic` com Lora
- Peso máximo: **600** (nunca 700/800/900)
- Nunca misturar Lora e Inter no **mesmo elemento**

---

## Espaçamento

Sistema baseado em múltiplos de 4px.

| Valor | Uso |
|---|---|
| 4px | Gap mínimo (dot separador e texto) |
| 8px | Gap entre badges/tags |
| 10px | Padding interno de exemplo |
| 12px | Padding de botão, gap de meta |
| 16px | Margem entre secções |
| 20px | Padding lateral do body |
| 24px | Margem após search bar |

---

## Bordas e Raios

| Token | Valor | Uso |
|---|---|---|
| `radius-sm` | 4px | Badges, tags, kbd |
| `radius-md` | 6px | Botão salvar |
| `radius-lg` | 8px | Search bar, frame da janela |
| `border-width` | 1px | Todas as bordas (nunca 0.5px no Electron) |

---

## Elevação (sem sombras)

Hierarquia criada APENAS por cor de superfície:

```
surface-sunken (#F0EEE9)  ← titlebar, nav, statusbar  [mais escuro = mais "fundo"]
surface-base   (#F7F6F3)  ← body do app
surface-raised (#FFFFFF)  ← input, cards elevados      [mais claro = mais "acima"]
```

**❌ Proibido:** `box-shadow`, `drop-shadow`, `filter: shadow`, gradientes de qualquer tipo.

---

## Como Aplicar com Tailwind v4

O projeto usa Tailwind v4 com CSS customizado. Use variáveis CSS para os tokens:

```css
/* globals.css — definição dos tokens */
:root {
  --surface-base: #F7F6F3;
  --surface-raised: #FFFFFF;
  --surface-sunken: #F0EEE9;
  --surface-hover: #ECEAE4;
  --border-subtle: #E2E0DA;
  --border-muted: #ECEAE4;
  --text-primary: #1A1918;
  --text-secondary: #2C2C2A;
  --text-muted: #888780;
  --text-faint: #B4B2A9;
  --accent-bg: #E6F1FB;
  --accent-text: #0C447C;
  --tag-bg: #ECEAE4;
  --tag-text: #5F5E5A;
}
```

```tsx
// ✅ CERTO — usar classes semânticas ou CSS vars
<div className="bg-[--surface-sunken] border-b border-[--border-subtle]">

// ✅ CERTO — CSS class semântica definida em globals.css
<div className="titlebar">

// ❌ ERRADO — cor hardcoded inline (mesmo sendo igual ao token, não use hex direto)
<div className="bg-[--surface-sunken]">  // ← forma correta via var CSS

// ❌ ERRADO — sombra
<div className="shadow-md">

// ❌ ERRADO — qualquer gradiente (bg-linear-to-r, bg-radial, etc.)
<div className="bg-linear-to-r from-blue-500">  // ← proibido independente da sintaxe
```

---

## Componentes Core — Padrões

### SectionLabel
```tsx
<p className="section-label">{children}</p>
// font: Inter 10px/500, uppercase, letter-spacing: 1.2px, cor: #B4B2A9
```

### Badge de Contexto (azul)
```tsx
<span className="tag-context">{ctx}</span>
// bg: #E6F1FB, text: #0C447C, border-radius: 4px
```

### Tag Neutra (sinónimo, clicável)
```tsx
<button className="tag" onClick={() => onSearch(syn)}>{syn}</button>
// bg: #ECEAE4, text: #5F5E5A, hover: bg #D3D1C7
```

### Nav Item (ativo vs. inativo)
```tsx
// Ativo: border-bottom 2px solid #2C2C2A, cor #2C2C2A
// Inativo: border-bottom transparent, cor #888780
// NUNCA: background colorido no item ativo
```

---

## ❌ Proibido (resumo rápido)

```
❌ box-shadow / drop-shadow
❌ background gradients
❌ border-radius > 8px (exceto a janela: 10px)
❌ font-weight > 600
❌ Misturar Lora + Inter no mesmo elemento
❌ Usar azul (#0C447C / #E6F1FB) para decoração — só contextos semânticos
❌ Cores hardcoded inline no JSX
❌ border-width: 0.5px (não funciona bem no Electron)
```

---

## Checklist Visual

Antes de submeter qualquer UI:

- [ ] Cores retiradas dos tokens (não hardcoded inline)
- [ ] Tipografia: Lora para conteúdo lexicográfico, Inter para chrome
- [ ] Nenhum elemento com `box-shadow` ou gradiente
- [ ] `border-radius` ≤ 8px (exceto window frame: 10px)
- [ ] Labels de secção em uppercase com letter-spacing
- [ ] Azul usado APENAS para badges de contexto ou estado active
- [ ] Hierarquia por superfície, não por sombra
- [ ] Ver `LEXIO_DESIGN_SYSTEM.md` para componentes completos

---

## Priority Level: HIGH

Consistência visual é crítica. Em caso de dúvida, consultar `LEXIO_DESIGN_SYSTEM.md`.
