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
      },
    },
    { type: 'separator' },
    {
      label: 'Atalho: ' + (process.platform === 'darwin' ? '⌘+Alt+E' : 'Ctrl+Alt+E'),
      enabled: false,
    },
    {
      label: 'Traduzir: ' + (process.platform === 'darwin' ? '⌘+Alt+T' : 'Ctrl+Alt+T'),
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Sair do Lexio',
      click: () => {
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    win.show()
    win.focus()
  })

  return tray
}
