import { _electron as electron } from '@playwright/test'
import { test, expect } from '@playwright/test'
import path from 'path'

test('launch app and check title', async () => {
  const electronApp = await electron.launch({ 
    args: [path.join(__dirname, '../dist-main/main/index.js')],
    executablePath: require('electron'),
    timeout: 60000 // Aumenta timeout para 60s
  })

  // Captura logs do processo principal
  electronApp.on('window', async (page) => {
    const filename = page.url().split('/').pop()
    console.log(`Window opened: ${filename}`)
    
    page.on('console', msg => console.log(`WINDOW LOG: ${msg.text()}`))
    page.on('pageerror', err => console.error(`WINDOW ERROR: ${err.message}`))
  })

  const window = await electronApp.firstWindow()
  
  // Aguarda a janela estar visível e carregar o conteúdo
  await window.waitForLoadState('domcontentloaded')
  
  const title = await window.title()
  expect(title).toBe('Lexio')
  
  await electronApp.close()
})
