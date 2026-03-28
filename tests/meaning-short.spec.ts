// tests/meaning-short.spec.ts
// Verifies that meanings[0].meaning_short is populated by the AI response
// and rendered in the SIGNIFICADO section of DefinitionView.

import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import path from 'path'
import os from 'os'
import fs from 'fs'

// ---------------------------------------------------------------------------
// Mock AI response — matches the Groq chat completion shape used by ai.ts
// ---------------------------------------------------------------------------
const MOCK_WORD = 'antigravity'
const MOCK_MEANING_SHORT = 'Força ou tecnologia que anula a gravidade.'

const mockGroqResponse = {
  id: 'mock-id',
  object: 'chat.completion',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: JSON.stringify({
          word: MOCK_WORD,
          phonetic: '/ˌæntɪˈɡræv.ɪ.ti/',
          pos: 'noun',
          level: 'Advanced',
          verb_forms: null,
          meanings: [
            {
              context: 'Technology',
              meaning_en: 'A hypothetical force opposing gravity.',
              meaning_short: MOCK_MEANING_SHORT,
              meaning: 'Um conceito hipotético que descreve uma força capaz de neutralizar ou reverter a gravidade, muito usado em ficção científica.',
              examples: [
                {
                  en: 'The spacecraft used antigravity technology to hover silently above the city.',
                  translation: 'A nave usou tecnologia antigravidade para pairar silenciosamente sobre a cidade.',
                },
                {
                  en: 'Scientists still debate whether antigravity is physically possible.',
                  translation: 'Cientistas ainda debatem se a antigravidade é fisicamente possível.',
                },
              ],
            },
            {
              context: 'Literature',
              meaning_en: 'A fictional device or concept used in science fiction.',
              meaning_short: 'Dispositivo fictício usado na ficção científica.',
              meaning: 'Na ficção, qualquer mecanismo que permite anular ou inverter a gravidade.',
              examples: [
                {
                  en: 'In the novel, an antigravity belt allowed the hero to fly freely.',
                  translation: 'No romance, um cinto antigravidade permitia ao herói voar livremente.',
                },
              ],
            },
          ],
          synonyms: ['levitation', 'zero-gravity'],
          antonyms: [],
          contexts: ['Technology', 'Literature'],
        }),
      },
      finish_reason: 'stop',
    },
  ],
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

let app: ElectronApplication
let page: Page
let tmpUserDataDir: string

test.beforeAll(async () => {
  // Use an isolated temp directory so the test always starts with a fresh DB,
  // avoiding migration failures caused by stale production/dev databases.
  tmpUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lexio-test-'))

  app = await electron.launch({
    args: [
      path.join(__dirname, '../dist-main/main/index.js'),
      `--user-data-dir=${tmpUserDataDir}`,
    ],
    executablePath: require('electron'),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      // Value is irrelevant — Groq network calls are mocked via page.route()
      VITE_GROQ_API_KEY: 'sk-mock-groq-key',
    },
    timeout: 60000,
  })

  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  // Capture renderer console output so test failures are diagnosable
  page.on('console', (msg) => {
    console.log(`[renderer ${msg.type()}] ${msg.text()}`)
  })
  page.on('pageerror', (err) => {
    console.error(`[renderer pageerror] ${err.message}`)
  })

  // Wait for the app shell to hydrate
  await page.waitForSelector('[data-testid="search-input"]', { timeout: 15000 })
})

test.afterAll(async () => {
  await app.close()
  // Clean up isolated DB directory
  fs.rmSync(tmpUserDataDir, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// Test 1 — meaning_short is populated from the AI response and rendered
// ---------------------------------------------------------------------------

test('meaning_short is fetched from AI and rendered in DefinitionView', async () => {
  // Intercept all Groq API calls — the mock returns a valid AIWordResponse
  // embedded in the choices[0].message.content field (Groq chat format).
  await page.route('https://api.groq.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockGroqResponse),
    })
  })

  // Submit a search — the word is not in the fresh DB, so an AI call will fire
  await page.click('[data-testid="search-input"]')
  await page.fill('[data-testid="search-input"]', MOCK_WORD)
  await page.keyboard.press('Enter')

  // The primary meaning paragraph must appear and contain meaning_short text
  const meaningShort = page.locator('[data-testid="meaning-short-0"]')
  await expect(meaningShort).toBeVisible({ timeout: 15000 })
  await expect(meaningShort).toHaveText(MOCK_MEANING_SHORT)

  await page.unroute('https://api.groq.com/**')
})

// ---------------------------------------------------------------------------
// Test 2 — DB cache: second search returns meaning_short without an AI call
// ---------------------------------------------------------------------------

test('meaning_short is served from DB cache on second search of the same word', async () => {
  // Install a route that should NOT be called — if it is, it means meaning_short
  // was not persisted correctly in the DB from test 1.
  let aiWasCalled = false
  await page.route('https://api.groq.com/**', async (route) => {
    aiWasCalled = true
    // Still fulfill so the app doesn't hang if the call does happen
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockGroqResponse),
    })
  })

  await page.fill('[data-testid="search-input"]', MOCK_WORD)
  await page.keyboard.press('Enter')

  const meaningShort = page.locator('[data-testid="meaning-short-0"]')
  await expect(meaningShort).toBeVisible({ timeout: 10000 })

  // Verify the persisted text is non-empty
  const text = await meaningShort.textContent()
  expect(text?.trim().length).toBeGreaterThan(0)

  // Verify the AI was NOT called — meaning_short came from the DB cache
  expect(aiWasCalled).toBe(false)

  await page.unroute('https://api.groq.com/**')
})
