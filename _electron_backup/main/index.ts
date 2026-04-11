import { app, BrowserWindow, screen } from 'electron'
import path from 'path'
import { registerIpcHandlers } from './ipc'
import { registerShortcut } from './shortcut'
import { createTray } from './tray'
import { setupAutoUpdater } from './updater'
import * as db from './db'
import { createOverlayWindow, registerTranslateShortcut, registerOverlayToggleShortcut } from './overlay'
import { initSelectionHook } from './text-bridge'

const isDev = !app.isPackaged

function createWindow() {
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { width: sw, height: sh } = display.workAreaSize
  const { x: dx, y: dy } = display.workArea

  const win = new BrowserWindow({
    width: 600,
    height: 60,
    x: dx + Math.round((sw - 600) / 2),
    y: dy + Math.round(sh * 0.25),
    frame: false,
    hasShadow: true,
    resizable: false,
    transparent: true,
    skipTaskbar: false,
    show: false,
    icon: path.join(__dirname, '../../public/logo/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  win.once('ready-to-show', () => {
    win.show()
    setupAutoUpdater(win)
  })
  registerIpcHandlers(win)
  registerShortcut(win)

  initSelectionHook()
  const overlay = createOverlayWindow()
  registerTranslateShortcut(overlay)
  registerOverlayToggleShortcut(overlay)

  createTray(win, overlay)
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.lexio.app')
  }
  db.init()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('will-quit', () => {
  require('electron').globalShortcut.unregisterAll()
})