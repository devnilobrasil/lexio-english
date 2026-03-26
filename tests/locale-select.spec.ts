import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import path from 'path'

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  app = await electron.launch({
    args: [path.join(__dirname, '../dist-main/main/index.js')],
    executablePath: require('electron'),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      VITE_ANTHROPIC_API_KEY: 'sk-mock-key-for-testing',
    },
    timeout: 60000,
  })

  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  // Mock Claude API — safety net for any accidental network calls
  await page.route('https://api.anthropic.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [{ type: 'text', text: '{}' }],
      }),
    })
  })

  // Wait for React to hydrate and the nav to be present
  await page.waitForSelector('[data-testid="nav-search"]', { timeout: 15000 })
})

test.afterAll(async () => {
  await app.close()
})

// Reset locale to pt-BR after each test to keep tests independent
test.afterEach(async () => {
  // Use the UI itself to reset — open the dropdown and click pt-BR
  await page.click('[data-testid="locale-trigger"]')
  await page.waitForSelector('[data-testid="locale-option-pt-BR"]', { state: 'visible' })
  await page.click('[data-testid="locale-option-pt-BR"]')
  await expect(page.locator('[data-testid="nav-search"]')).toHaveText('Busca')
})

// ─── Test 1: Default locale is pt-BR ────────────────────────────────────────

test('locale padrão é pt-BR — nav e placeholder em português', async () => {
  await expect(page.locator('[data-testid="nav-search"]')).toHaveText('Busca')
  await expect(page.locator('[data-testid="nav-saved"]')).toHaveText('Salvos')
  await expect(page.locator('[data-testid="nav-history"]')).toHaveText('Histórico')

  await expect(page.locator('[data-testid="search-input"]')).toHaveAttribute(
    'placeholder',
    'Busque uma palavra em inglês...',
  )
})

// ─── Test 2: Switch to English ───────────────────────────────────────────────

test('troca para inglês — nav e placeholder em inglês', async () => {
  await page.click('[data-testid="locale-trigger"]')
  await page.waitForSelector('[data-testid="locale-option-en"]', { state: 'visible' })
  await page.click('[data-testid="locale-option-en"]')

  await expect(page.locator('[data-testid="nav-search"]')).toHaveText('Search')
  await expect(page.locator('[data-testid="nav-saved"]')).toHaveText('Saved')
  await expect(page.locator('[data-testid="nav-history"]')).toHaveText('History')

  await expect(page.locator('[data-testid="search-input"]')).toHaveAttribute(
    'placeholder',
    'Search for an English word...',
  )
})

// ─── Test 3: Switch to Spanish ───────────────────────────────────────────────

test('troca para espanhol — nav e placeholder em espanhol', async () => {
  await page.click('[data-testid="locale-trigger"]')
  await page.waitForSelector('[data-testid="locale-option-es"]', { state: 'visible' })
  await page.click('[data-testid="locale-option-es"]')

  await expect(page.locator('[data-testid="nav-search"]')).toHaveText('Buscar')
  await expect(page.locator('[data-testid="nav-saved"]')).toHaveText('Guardados')
  await expect(page.locator('[data-testid="nav-history"]')).toHaveText('Historial')

  await expect(page.locator('[data-testid="search-input"]')).toHaveAttribute(
    'placeholder',
    'Busca una palabra en inglés...',
  )
})

// ─── Test 4: Locale persists in localStorage ─────────────────────────────────

test('locale persiste no localStorage após troca para inglês', async () => {
  // Start from pt-BR (guaranteed by beforeAll initial state + afterEach reset)
  await expect(page.locator('[data-testid="nav-search"]')).toHaveText('Busca')

  // Switch to English via the LocaleSelect UI
  await page.click('[data-testid="locale-trigger"]')
  await page.waitForSelector('[data-testid="locale-option-en"]', { state: 'visible' })
  await page.click('[data-testid="locale-option-en"]')

  // Verify UI updated to English
  await expect(page.locator('[data-testid="nav-search"]')).toHaveText('Search')

  // Verify the value was written to localStorage with the correct key
  const persisted = await page.evaluate(() =>
    window.localStorage.getItem('lexio_locale'),
  )
  expect(persisted).toBe('en')
})
