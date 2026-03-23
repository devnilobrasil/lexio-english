// src/main/index.ts
import { app, BrowserWindow, screen } from 'electron'
import path from 'path'
import { registerIpcHandlers } from './ipc'
import { registerShortcut } from './shortcut'
import { createTray } from './tray'
import * as db from './db'

const isDev = !app.isPackaged

function createWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize

  const win = new BrowserWindow({
    width: 720,
    height: 620,
    x: Math.round((sw - 720) / 2),
    y: Math.round((sh - 620) / 2),
    frame: false,
    transparent: true,
    resizable: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    // win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  win.on('blur', () => {
    if (!isDev) win.hide()
  })

  registerIpcHandlers(win)
  registerShortcut(win)
  createTray(win)

  win.once('ready-to-show', () => {
    win.show()
  })
}

app.whenReady().then(() => {
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
