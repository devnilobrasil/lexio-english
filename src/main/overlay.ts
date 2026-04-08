// src/main/overlay.ts
// Gerencia a BrowserWindow do overlay flutuante e orquestra o fluxo de tradução

import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { captureSelection, injectText } from './text-bridge'
import { translateText } from './translate'

const isDev = !app.isPackaged
const POSITION_FILE = path.join(app.getPath('userData'), 'overlay-position.json')

interface OverlayPosition { x: number; y: number }

export function loadOverlayPosition(): OverlayPosition {
  try {
    const raw = fs.readFileSync(POSITION_FILE, 'utf-8')
    return JSON.parse(raw) as OverlayPosition
  } catch {
    return { x: 32, y: 200 }
  }
}

export function saveOverlayPosition(x: number, y: number): void {
  fs.writeFileSync(POSITION_FILE, JSON.stringify({ x, y }))
}

export function createOverlayWindow(): BrowserWindow {
  const pos = loadOverlayPosition()

  const overlay = new BrowserWindow({
    width: 48,
    height: 48,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/overlay-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  overlay.setAlwaysOnTop(true, 'screen-saver')

  if (isDev) {
    overlay.loadURL('http://localhost:5173/overlay.html')
  } else {
    overlay.loadFile(path.join(__dirname, '../../dist/overlay.html'))
  }

  // IPC: drag (o overlay não pode ter foco, então usamos setPosition)
  ipcMain.on('overlay:drag-start', () => {
    // drag é gerenciado pelo renderer via mousemove + setPosition
  })

  ipcMain.on('overlay:set-position', (_event, x: number, y: number) => {
    overlay.setPosition(Math.round(x), Math.round(y))
    saveOverlayPosition(Math.round(x), Math.round(y))
  })

  // IPC: tradução disparada pelo botão na UI
  ipcMain.on('overlay:translate', () => {
    runTranslationFlow(overlay).catch(err => {
      console.error('[overlay] translation error:', err)
      overlay.webContents.send('overlay:state', 'error')
      overlay.webContents.send('overlay:error', String(err))
    })
  })

  return overlay
}

export function registerTranslateShortcut(overlay: BrowserWindow): void {
  const shortcut = 'Control+Shift+T'
  globalShortcut.unregister(shortcut)
  globalShortcut.register(shortcut, () => {
    runTranslationFlow(overlay).catch(err => {
      console.error('[overlay] translation error:', err)
      overlay.webContents.send('overlay:state', 'error')
      overlay.webContents.send('overlay:error', String(err))
    })
  })
}

async function runTranslationFlow(overlay: BrowserWindow): Promise<void> {
  const selection = await captureSelection()
  if (!selection?.text) return

  overlay.webContents.send('overlay:state', 'loading')

  const translated = await translateText(selection.text)
  await injectText(translated)

  overlay.webContents.send('overlay:state', 'success')
  await new Promise(r => setTimeout(r, 2000))
  overlay.webContents.send('overlay:state', 'idle')
}

export function showOverlay(overlay: BrowserWindow): void {
  overlay.show()
}

export function hideOverlay(overlay: BrowserWindow): void {
  overlay.hide()
}
