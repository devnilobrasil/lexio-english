// src/main/tray.ts
import { app, Menu, Tray, nativeImage, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'

export function createTray(win: BrowserWindow): Tray {
  const iconPath = path.join(__dirname, '../../public/logo/tray.ico')
  let icon
  
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath)
  } else {
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
