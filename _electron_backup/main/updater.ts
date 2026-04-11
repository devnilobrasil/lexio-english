// src/main/updater.ts
import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { BrowserWindow } from 'electron'

export function setupAutoUpdater(win: BrowserWindow): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    win.webContents.send('update:available', info.version)
  })

  autoUpdater.on('update-not-available', () => {
    win.webContents.send('update:not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    win.webContents.send('update:progress', Math.round(progress.percent))
  })

  autoUpdater.on('update-downloaded', (info) => {
    win.webContents.send('update:downloaded', info.version)
  })

  autoUpdater.on('error', (err) => {
    win.webContents.send('update:error', err.message)
  })

  if (app.isPackaged) {
    autoUpdater.checkForUpdates()
  }
}

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall()
}
