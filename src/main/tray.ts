// src/main/tray.ts
import { app, Menu, Tray, nativeImage, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'

export function createTray(win: BrowserWindow): Tray {
  // Tenta carregar o ícone oficial, se não existir usa um ícone vazio para não quebrar
  const iconPath = path.join(__dirname, '../../public/icon.png')
  let icon
  
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  } else {
    // Cria um ícone vazio (fallback)
    icon = nativeImage.createEmpty()
  }

  const tray = new Tray(icon)
  
  tray.setToolTip('Lexio — Inglês sob demanda')
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Abrir Lexio', 
      click: () => { 
        win.show()
        win.focus()
      } 
    },
    { type: 'separator' },
    { 
      label: 'Atalho: ' + (process.platform === 'darwin' ? '⌘+Shift+E' : 'Ctrl+Shift+E'), 
      enabled: false 
    },
    { type: 'separator' },
    { 
      label: 'Sair do Lexio', 
      click: () => {
        app.quit()
      } 
    }
  ])

  tray.setContextMenu(contextMenu)

  // Clique no ícone abre/foca o app
  tray.on('click', () => {
    if (win.isVisible()) {
      win.focus()
    } else {
      win.show()
      win.focus()
    }
  })

  return tray
}
