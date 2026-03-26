---
name: lexio-testing
description: Padrões de teste E2E do Lexio com Playwright + Electron. Inclui como inicializar o Electron no teste, como mockar a Claude API para não gastar créditos, e estrutura de testes.
context: fork
---

# Lexio Testing Skill

## Stack de Testes

| Tipo | Ferramenta | Localização |
|---|---|---|
| E2E (End-to-End) | Playwright + `electron` launch | `tests/` |
| Resultados | `test-results/` | Gerado automaticamente |

O projeto **não usa Vitest** para unit tests. A abordagem é E2E via Playwright que instrumenta o Electron diretamente.

---

## Inicializando o Electron no Playwright

Playwright com Electron usa `_electron.launch()` para iniciar o processo:

```ts
// tests/app.spec.ts
import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import path from 'path'

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  // Inicia o Electron apontando para o dist-main compilado
  app = await electron.launch({
    args: [path.join(__dirname, '../dist-main/main/index.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      VITE_ANTHROPIC_API_KEY: 'sk-mock-key-for-testing',  // key falsa para testes
    },
  })
  
  // Obtém a janela principal
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await app.close()
})
```

**Pré-requisito:** O build do main deve existir antes dos testes.

```bash
npx tsc -p tsconfig.main.json   # compila main
npm run build:renderer           # compila renderer
# agora pode rodar os testes
npx playwright test
```

---

## Como Mockar a Claude API (CRÍTICO)

Nunca chamar a API real em testes. Use `page.route()` para interceptar chamadas de rede:

```ts
test('busca palavra e mostra WordCard', async () => {
  // Intercepta chamadas à Anthropic antes de qualquer interação
  await page.route('https://api.anthropic.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [{
          type: 'text',
          text: JSON.stringify({
            word: 'churn',
            phonetic: 'tʃɜːrn',
            pos: 'verb',
            level: 'Intermediário',
            meaning_pt: 'Mudança frequente de clientes ou assinantes que cancelam um serviço.',
            meaning_en: 'The rate at which customers stop subscribing to a service.',
            examples: [
              { en: 'Our churn rate dropped by 20% this quarter.', pt: 'Nossa taxa de churn caiu 20% neste trimestre.' },
              { en: 'High churn is a sign of poor customer satisfaction.', pt: 'Alto churn é sinal de baixa satisfação.' },
              { en: 'We need to reduce churn to grow revenue.', pt: 'Precisamos reduzir o churn para crescer.' },
            ],
            synonyms: ['attrition', 'turnover', 'dropout'],
            contexts: ['Negócios', 'Tecnologia'],
          }),
        }],
      }),
    })
  })
  
  // Agora interage com o app
  await page.fill('[data-testid="search-input"]', 'churn')
  await page.keyboard.press('Enter')
  
  // Verifica o WordCard
  await expect(page.locator('[data-testid="word-title"]')).toHaveText('churn')
  await expect(page.locator('[data-testid="word-phonetic"]')).toContainText('tʃɜːrn')
})
```

---

## IDs de Teste Necessários

Para que os testes funcionem, componentes React precisam de `data-testid`:

```tsx
// SearchBar.tsx
<input
  data-testid="search-input"
  type="text"
  placeholder="Busque uma palavra em inglês..."
  ...
/>

// WordCard.tsx
<div data-testid="word-card">
  <h1 data-testid="word-title">{word.word}</h1>
  <span data-testid="word-phonetic">/{word.phonetic}/</span>
  <p data-testid="word-meaning-pt">{word.meaning_pt}</p>
</div>

// Nav.tsx
<button data-testid="nav-saved">Salvos</button>
<button data-testid="nav-history">Histórico</button>
```

**Regra:** `data-testid` nunca deve ser removido. É documentação viva dos pontos de interação.

---

## Estrutura de Testes Recomendada

```
tests/
├── app.spec.ts          ← setup global + testes de inicialização
├── search.spec.ts       ← busca, WordCard, cache
├── saved.spec.ts        ← salvar/remover palavras
└── history.spec.ts      ← histórico de buscas
```

---

## Testes Prioritários

### 1. Fluxo de Busca (mais crítico)

```ts
test('busca palavra nova — chama Claude API e mostra resultado', ...)
test('busca palavra existente — usa cache SQLite sem chamar API', ...)
test('busca palavra com Enter key', ...)
```

### 2. Navegação

```ts
test('troca para aba Salvos', ...)
test('troca para aba Histórico', ...)
```

### 3. Salvar/Remover

```ts
test('salva palavra clicando no botão', ...)
test('remove palavra dos salvos', ...)
```

### 4. Sinônimos clicáveis

```ts
test('clica em sinônimo — busca aquela palavra', ...)
```

---

## Rodando os Testes

```bash
# Rodar todos os testes
npx playwright test

# Rodar com UI (útil para debug)
npx playwright test --ui

# Rodar um arquivo específico
npx playwright test tests/search.spec.ts

# Ver relatório após execução
npx playwright show-report
```

---

## Configuração do Playwright (`playwright.config.ts`)

Se não existir, criar na raiz:

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    // Electron não usa baseURL
  },
  // Sem servidor web — Electron é lançado diretamente nos testes
})
```

---

## ❌ Proibido

```ts
// ❌ Chamar a API real nos testes
// SEMPRE mockar com page.route() antes da interação

// ❌ Hardcodar API key real no env de teste
VITE_ANTHROPIC_API_KEY: 'sk-ant-api03-...'  // key real

// ❌ Testes que dependem de ordem de execução
// Cada test deve ser independente — usar beforeEach para reset de estado

// ❌ Testes sem data-testid — usar seletores de texto ou classe
await page.click('.save-btn')  // frágil — usar data-testid
await page.click('[data-testid="save-button"]')  // correto
```

---

## Priority Level: MEDIUM

Testes E2E garantem que o fluxo completo (busca → WordCard → salvar) funciona após qualquer mudança.  
Mockar a Claude API é obrigatório — testes reais gastariam créditos a cada execução.
