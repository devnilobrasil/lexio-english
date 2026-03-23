// src/main/shortcut.ts
import { globalShortcut, screen, BrowserWindow } from 'electron'

export function registerShortcut(win: BrowserWindow): void {
  const shortcut = process.platform === 'darwin' ? 'Command+Shift+E' : 'Control+Shift+E'

  // Remove atalho anterior se existir (evita duplicatas no reload)
  globalShortcut.unregister(shortcut)

  const success = globalShortcut.register(shortcut, () => {
    if (win.isVisible() && win.isFocused()) {
      win.hide()
    } else {
      // Centraliza na tela onde o cursor está no momento
      const cursor = screen.getCursorScreenPoint()
      const { x, y, width, height } = screen.getDisplayNearestPoint(cursor).workArea
      const [w, h] = win.getSize()
      
      win.setPosition(
        Math.round(x + (width - w) / 2), 
        Math.round(y + (height - h) / 2)
      )
      
      win.show()
      win.focus()
    }
  })

  if (!success) {
    console.error('Failed to register global shortcut')
  }
}
