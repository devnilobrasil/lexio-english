# Lexio — Design System

> Referência visual e de implementação para todos os componentes do app.  
> Toda decisão de UI deve derivar deste documento.

---

## Princípios

**Editorial, não tecnológico.** O Lexio lida com linguagem — deve sentir-se como um dicionário refinado, não como um dashboard de SaaS. Tipografia com carácter, espaço para respirar, hierarquia clara.

**Densidade honesta.** Apps desktop podem mostrar mais informação por cm² que apps mobile. Não padding excessivo, não cards desnecessários. Separadores e espaçamento fazem o trabalho de organizar.

**Uma cor de acento, usada com parcimônia.** O azul existe para contextos semânticos (badges de categoria) e estados interativos. Não para decoração.

**Sem sombras, sem gradientes.** Bordas finas e superfícies sólidas. Qualidade vem de proporção e tipografia, não de efeitos visuais.

---

## Tokens

### Cores

#### Superfícies

| Token | Hex | Uso |
|---|---|---|
| `surface-base` | `#F7F6F3` | Fundo principal do app |
| `surface-raised` | `#FFFFFF` | Input, cards elevados |
| `surface-sunken` | `#F0EEE9` | Titlebar, nav, statusbar |
| `surface-hover` | `#ECEAE4` | Hover em itens de lista |

#### Bordas

| Token | Hex | Uso |
|---|---|---|
| `border-subtle` | `#E2E0DA` | Bordas gerais, divisores de secção |
| `border-muted` | `#ECEAE4` | Divisores internos (entre exemplos) |

#### Texto

| Token | Hex | Uso |
|---|---|---|
| `text-primary` | `#1A1918` | Palavra, significado PT, corpo principal |
| `text-secondary` | `#2C2C2A` | Exemplos em inglês |
| `text-muted` | `#888780` | Fonética, pos, traduções, placeholders |
| `text-faint` | `#B4B2A9` | Labels uppercase, status bar, kbd hint |

#### Acento — Azul (contextos semânticos)

| Token | Hex | Uso |
|---|---|---|
| `accent-bg` | `#E6F1FB` | Fundo de badge de contexto |
| `accent-text` | `#0C447C` | Texto de badge de contexto |

#### Acento — Verde (status)

| Token | Hex | Uso |
|---|---|---|
| `status-online` | `#639922` | Ponto de status "Online" |

#### Tags neutras (sinónimos)

| Token | Hex | Uso |
|---|---|---|
| `tag-bg` | `#ECEAE4` | Fundo de tag neutra |
| `tag-text` | `#5F5E5A` | Texto de tag neutra |

---

### Tipografia

O sistema usa dois typefaces com papéis completamente distintos.

#### Famílias

| Família | Papel | Google Fonts |
|---|---|---|
| `Lora` | Serif — palavra, significado PT | `Lora:ital,wght@0,400;0,600;1,400` |
| `Inter` | Sans — todo o chrome, meta, labels | `Inter:wght@400;500` |

```html
<!-- Importação no index.html -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500&display=swap" rel="stylesheet">
```

#### Escala

| Papel | Família | Tamanho | Peso | Cor |
|---|---|---|---|---|
| Palavra principal | Lora | 42px | 600 | `text-primary` |
| Significado PT | Lora | 17px | 400 | `text-primary` |
| Significado EN | Lora italic | 13px | 400 | `text-muted` |
| Exemplo EN | Inter | 13px | 400 | `text-secondary` |
| Exemplo PT | Inter | 12px | 400 | `text-muted` |
| Label de secção | Inter | 10px | 500 | `text-faint` |
| Nav item | Inter | 12px | 500 | `text-muted` / `text-primary` |
| Badge / tag | Inter | 10–11px | 500 | variável |
| Placeholder input | Inter | 14px | 400 | `text-faint` |
| Status bar | Inter | 10px | 400 | `text-faint` |

#### Regras

- Labels de secção sempre em `uppercase` com `letter-spacing: 1.2px`
- Fonética em `font-style: italic` com a família Lora
- Nunca usar peso acima de 600
- Nunca misturar as duas famílias no mesmo elemento

---

### Espaçamento

Sistema baseado em múltiplos de 4px.

| Token | Valor | Uso |
|---|---|---|
| `space-1` | 4px | Gap mínimo (entre dot separador e texto) |
| `space-2` | 8px | Gap entre badges/tags |
| `space-3` | 10px | Padding interno de exemplo |
| `space-4` | 12px | Padding de botão, gap de meta |
| `space-5` | 16px | Margem entre secções |
| `space-6` | 20px | Padding lateral do body |
| `space-7` | 24px | Margem após search bar |

---

### Bordas e Raios

| Token | Valor | Uso |
|---|---|---|
| `radius-sm` | 4px | Badges, tags, kbd |
| `radius-md` | 6px | Botão salvar |
| `radius-lg` | 8px | Search bar, frame da janela |
| `border-width` | 1px | Todas as bordas (nunca 0.5px no Electron) |

---

### Elevação

O Lexio **não usa sombras**. Hierarquia é criada por cor de superfície:

```
surface-sunken (#F0EEE9)   ← titlebar, nav, statusbar
surface-base   (#F7F6F3)   ← corpo do app
surface-raised (#FFFFFF)   ← input, elementos interativos
```

---

## Componentes

### Titlebar

Barra de título customizada. Draggable. Sem frame nativo do Electron.

```tsx
// TitleBar.tsx
<div
  style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
  className="titlebar"
>
  <span className="titlebar-name">Lexio</span>
  <div className="titlebar-controls">
    <button
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      onClick={() => window.lexio.minimizeWindow()}
      className="window-dot dot-min"
    />
    <button
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      onClick={() => window.lexio.closeWindow()}
      className="window-dot dot-close"
    />
  </div>
</div>
```

```css
.titlebar {
  background: #F0EEE9;
  border-bottom: 1px solid #E2E0DA;
  height: 38px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  user-select: none;
}

.titlebar-name {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: #888780;
}

.window-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #E2E0DA;
  border: none;
  cursor: pointer;
}

.window-dot:hover {
  background: #D3D1C7;
}
```

---

### Navigation

Tabs horizontais. Underline no item ativo, nunca background colorido.

```tsx
// Nav.tsx
type View = 'search' | 'saved' | 'history'

<nav className="nav">
  {(['search', 'saved', 'history'] as View[]).map((view) => (
    <button
      key={view}
      className={`nav-item ${activeView === view ? 'active' : ''}`}
      onClick={() => setActiveView(view)}
    >
      {{ search: 'Busca', saved: 'Salvos', history: 'Histórico' }[view]}
    </button>
  ))}
</nav>
```

```css
.nav {
  background: #F0EEE9;
  border-bottom: 1px solid #E2E0DA;
  padding: 0 20px;
  display: flex;
}

.nav-item {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 500;
  color: #888780;
  padding: 10px 14px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  cursor: pointer;
  letter-spacing: 0.2px;
  transition: color 0.15s, border-color 0.15s;
}

.nav-item.active {
  color: #2C2C2A;
  border-bottom-color: #2C2C2A;
}

.nav-item:not(.active):hover {
  color: #5F5E5A;
}
```

---

### SearchBar

Input principal. Sempre em foco ao abrir o app.

```tsx
// SearchBar.tsx
<div className="search-wrap">
  <SearchIcon className="search-icon" />
  <input
    ref={inputRef}
    type="text"
    placeholder="Busque uma palavra em inglês..."
    className="search-input"
    value={query}
    onChange={(e) => setQuery(e.target.value)}
    onKeyDown={(e) => e.key === 'Enter' && onSearch(query)}
    spellCheck={false}
    autoComplete="off"
  />
  <kbd className="search-kbd">Enter</kbd>
</div>
```

```css
.search-wrap {
  background: #FFFFFF;
  border: 1px solid #E2E0DA;
  border-radius: 8px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  height: 42px;
  margin-bottom: 24px;
  transition: border-color 0.15s;
}

.search-wrap:focus-within {
  border-color: #B4B2A9;
}

.search-icon {
  width: 14px;
  height: 14px;
  color: #B4B2A9;
  margin-right: 10px;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  color: #1A1918;
  background: transparent;
  border: none;
  outline: none;
}

.search-input::placeholder {
  color: #B4B2A9;
}

.search-kbd {
  font-family: 'Inter', monospace;
  font-size: 10px;
  color: #B4B2A9;
  background: #F0EEE9;
  border: 1px solid #E2E0DA;
  border-radius: 4px;
  padding: 2px 7px;
}
```

---

### WordHeader

Título da palavra com meta-informação e botão de salvar.

```tsx
// WordHeader.tsx
<div className="word-section">
  <div className="word-left">
    <h1 className="word-title">{word.word}</h1>
    <div className="word-meta">
      {word.phonetic && (
        <span className="phonetic">/{word.phonetic}/</span>
      )}
      <span className="meta-dot" />
      <span className="pos">{word.pos}</span>
      <span className="meta-dot" />
      <span className="badge-level">{word.level}</span>
    </div>
  </div>
  <button
    className={`save-btn ${word.is_saved ? 'saved' : ''}`}
    onClick={() => onToggleSave(word.word)}
  >
    <StarIcon className="save-icon" />
    {word.is_saved ? 'Salvo' : 'Salvar'}
  </button>
</div>
```

```css
.word-section {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.word-title {
  font-family: 'Lora', serif;
  font-size: 42px;
  font-weight: 600;
  color: #1A1918;
  line-height: 1;
  margin-bottom: 8px;
  letter-spacing: -0.5px;
}

.word-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.phonetic {
  font-family: 'Lora', serif;
  font-size: 13px;
  font-style: italic;
  color: #888780;
}

.meta-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #D3D1C7;
}

.pos {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  color: #888780;
}

.badge-level {
  font-family: 'Inter', sans-serif;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  background: #F0EEE9;
  color: #5F5E5A;
  border: 1px solid #D3D1C7;
  border-radius: 4px;
  padding: 2px 8px;
}

/* Botão Salvar */
.save-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 500;
  color: #888780;
  background: transparent;
  border: 1px solid #E2E0DA;
  border-radius: 6px;
  padding: 7px 12px;
  cursor: pointer;
  margin-top: 6px;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.save-btn:hover {
  color: #2C2C2A;
  border-color: #B4B2A9;
}

.save-btn.saved {
  color: #0C447C;
  background: #E6F1FB;
  border-color: #85B7EB;
}

.save-icon {
  width: 12px;
  height: 12px;
}
```

---

### SectionLabel

Label de secção reutilizável. Sempre uppercase, sempre muted.

```tsx
// SectionLabel.tsx
<p className="section-label">{children}</p>
```

```css
.section-label {
  font-family: 'Inter', sans-serif;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: #B4B2A9;
  margin-bottom: 8px;
}
```

---

### MeaningBlock

Significado em PT + EN. Sem card, sem fundo colorido.

```tsx
// MeaningBlock.tsx
<div className="meaning-block">
  <p className="section-label">Significado</p>
  <p className="meaning-pt">{word.meaning_pt}</p>
  {word.meaning_en && (
    <p className="meaning-en">{word.meaning_en}</p>
  )}
</div>
```

```css
.meaning-pt {
  font-family: 'Lora', serif;
  font-size: 17px;
  line-height: 1.65;
  color: #1A1918;
  margin-bottom: 8px;
}

.meaning-en {
  font-family: 'Lora', serif;
  font-size: 13px;
  font-style: italic;
  line-height: 1.6;
  color: #888780;
  margin-bottom: 20px;
}
```

---

### ExampleItem

Exemplo de uso com tradução. Separados por borda fina, sem cards.

```tsx
// ExampleItem.tsx
<div className="example">
  <p
    className="example-en"
    dangerouslySetInnerHTML={{ __html: highlightWord(ex.en, word) }}
  />
  <p className="example-pt">{ex.pt}</p>
</div>
```

```css
.examples-list {
  display: flex;
  flex-direction: column;
}

.example {
  padding: 10px 0;
  border-top: 1px solid #ECEAE4;
}

.example:first-child {
  border-top: none;
  padding-top: 0;
}

.example-en {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  color: #2C2C2A;
  line-height: 1.55;
  margin-bottom: 3px;
}

/* Palavra destacada nos exemplos */
.example-en strong {
  font-weight: 600;
  color: #1A1918;
}

.example-pt {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  color: #888780;
  line-height: 1.5;
}
```

```ts
// util: highlight da palavra no exemplo
function highlightWord(text: string, word: string): string {
  const re = new RegExp(`\\b(${word}\\w*)\\b`, 'gi')
  return text.replace(re, '<strong>$1</strong>')
}
```

---

### TagRow

Sinónimos e contextos no rodapé do WordCard.

```tsx
// TagRow.tsx
<div className="tags-section">
  {word.synonyms.map((syn) => (
    <button
      key={syn}
      className="tag"
      onClick={() => onSearch(syn)}  // clica → busca o sinónimo
    >
      {syn}
    </button>
  ))}
  {word.contexts.map((ctx) => (
    <span key={ctx} className="tag-context">{ctx}</span>
  ))}
</div>
```

```css
.tags-section {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 16px 0 20px;
  border-top: 1px solid #E2E0DA;
  margin-top: 4px;
}

/* Tag neutra — sinónimos (clicável) */
.tag {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 400;
  color: #5F5E5A;
  background: #ECEAE4;
  border: none;
  border-radius: 4px;
  padding: 3px 10px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.tag:hover {
  background: #D3D1C7;
  color: #2C2C2A;
}

/* Tag de contexto — não clicável */
.tag-context {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 500;
  color: #0C447C;
  background: #E6F1FB;
  border-radius: 4px;
  padding: 3px 10px;
}
```

---

### Divider

Separador de secção. Substitui cards como organizador visual.

```tsx
<hr className="divider" />
```

```css
.divider {
  height: 1px;
  background: #E2E0DA;
  border: none;
  margin: 0 0 16px;
}
```

---

### StatusBar

Rodapé fixo com versão e status de conexão.

```tsx
// StatusBar.tsx
<div className="statusbar">
  <span className="status-text">Lexio v{version}</span>
  <div className="status-indicator">
    <div className={`status-dot ${online ? 'online' : 'offline'}`} />
    <span className="status-text">{online ? 'Online' : 'Offline'}</span>
  </div>
</div>
```

```css
.statusbar {
  background: #F0EEE9;
  border-top: 1px solid #E2E0DA;
  padding: 0 20px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.status-text {
  font-family: 'Inter', sans-serif;
  font-size: 10px;
  color: #B4B2A9;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-dot.online  { background: #639922; }
.status-dot.offline { background: #D85A30; }
```

---

## Layout Geral

### Estrutura da Janela

```
┌─────────────────────────────┐  ← Electron BrowserWindow
│ TitleBar          [_ ×]     │  38px  — surface-sunken
│─────────────────────────────│
│ Nav: Busca · Salvos · Hist. │  38px  — surface-sunken
│─────────────────────────────│
│                             │
│  [SearchBar            ↵]   │  body — surface-base
│                             │  overflow-y: auto
│  churn   Intermediário  ☆   │
│  /tʃɜːrn/ · Verb · Noun     │
│  ─────────────────────────  │
│  SIGNIFICADO                │
│  Mudança frequente de...    │
│  The rate at which...       │
│                             │
│  EXEMPLOS                   │
│  Our churn rate dropped...  │
│  Nossa taxa de churn...     │
│  ─────────────────────────  │
│  attrition  turnover  [SaaS]│
│                             │
│─────────────────────────────│
│ Lexio v1.0.0      ● Online  │  28px  — surface-sunken
└─────────────────────────────┘
```

### CSS da Janela Principal

```css
/* globals.css */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #root {
  height: 100%;
  overflow: hidden;
}

.app-window {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #F7F6F3;

  /* Cantos arredondados — requer transparent: true no Electron */
  border-radius: 10px;
  border: 1px solid #E2E0DA;
  overflow: hidden;
}

.app-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px 0;
}

/* Scrollbar discreta */
.app-body::-webkit-scrollbar {
  width: 4px;
}
.app-body::-webkit-scrollbar-track {
  background: transparent;
}
.app-body::-webkit-scrollbar-thumb {
  background: #D3D1C7;
  border-radius: 2px;
}
```

---

## Estados

### Loading

Enquanto a Claude API processa. Sem spinner genérico — dots animados com a palavra em destaque.

```tsx
<div className="loading-state">
  <span className="loading-word">"{query}"</span>
  <div className="loading-dots">
    <span /><span /><span />
  </div>
</div>
```

```css
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  padding: 8px 0;
}

.loading-word {
  font-family: 'Lora', serif;
  font-size: 42px;
  font-weight: 600;
  color: #D3D1C7;
  letter-spacing: -0.5px;
}

.loading-dots {
  display: flex;
  gap: 5px;
}

.loading-dots span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #B4B2A9;
  animation: pulse 1.2s ease-in-out infinite;
}

.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.loading-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50%       { opacity: 1;   transform: scale(1); }
}
```

### Empty State

Ecrã inicial sem palavra pesquisada.

```css
.empty-state {
  padding: 8px 0 24px;
  color: #B4B2A9;
}

.empty-label {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.history-chip {
  display: inline-block;
  font-family: 'Lora', serif;
  font-size: 14px;
  color: #888780;
  background: #F0EEE9;
  border: 1px solid #E2E0DA;
  border-radius: 6px;
  padding: 5px 12px;
  margin: 0 6px 6px 0;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.history-chip:hover {
  color: #2C2C2A;
  border-color: #B4B2A9;
}
```

### Error State

```css
.error-state {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  color: #D85A30;
  padding: 8px 0;
}
```

---

## Animações

Mínimas e funcionais. Nenhuma animação decorativa.

```css
/* Entrada do WordCard ao buscar uma nova palavra */
.word-card-enter {
  animation: slideUp 0.2s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Transições de estado em botões */
.save-btn,
.tag,
.nav-item,
.history-chip {
  transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}
```

---

## Tailwind Config

Caso use Tailwind em vez de CSS puro, extende o tema com os tokens do sistema.

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          base:    '#F7F6F3',
          raised:  '#FFFFFF',
          sunken:  '#F0EEE9',
          hover:   '#ECEAE4',
        },
        border: {
          subtle: '#E2E0DA',
          muted:  '#ECEAE4',
        },
        text: {
          primary:   '#1A1918',
          secondary: '#2C2C2A',
          muted:     '#888780',
          faint:     '#B4B2A9',
        },
        accent: {
          bg:   '#E6F1FB',
          text: '#0C447C',
        },
        tag: {
          bg:   '#ECEAE4',
          text: '#5F5E5A',
        },
      },
      fontFamily: {
        serif: ['Lora', 'Georgia', 'serif'],
        sans:  ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'word':    ['42px', { lineHeight: '1',    letterSpacing: '-0.5px', fontWeight: '600' }],
        'meaning': ['17px', { lineHeight: '1.65', fontWeight: '400' }],
        'label':   ['10px', { lineHeight: '1',    letterSpacing: '1.2px', fontWeight: '500' }],
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '10px',
      },
    },
  },
} satisfies Config
```

---

## O que nunca fazer

| Proibido | Motivo |
|---|---|
| `box-shadow` decorativo | Cria hierarquia falsa, parece SaaS genérico |
| Gradientes de fundo | O app parece um template de landing page |
| Cards com fundo colorido para significado | Já existe no layout original — foi removido intencionalmente |
| Botão de ação flutuante (FAB) | Padrão mobile, fora de contexto num app desktop |
| Mais de uma fonte serif | Lora é a única — misturar quebra a coerência editorial |
| `font-weight: 700` ou superior | Muito pesado para a paleta quente do app |
| `border-radius` acima de 10px em containers grandes | Parece mobile/iOS — o app é desktop |
| Uppercase em mais de 2 níveis de hierarquia | Labels de secção são a única exceção |
