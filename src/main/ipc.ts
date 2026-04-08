// src/main/ipc.ts
import { ipcMain, BrowserWindow } from 'electron'
import type { Locale } from '../types'
import * as db from './db'
import { quitAndInstall } from './updater'

export function registerIpcHandlers(win: BrowserWindow): void {
  ipcMain.handle('word:get',         (_, word: string, locale: Locale)  => db.getWord(word, locale))
  ipcMain.handle('word:save',        (_, data, locale: Locale)           => db.upsertWord(data, locale))
  ipcMain.handle('word:toggleSaved',        (_, word: string) => db.toggleSaved(word))
  ipcMain.handle('word:delete',             (_, word: string) => db.deleteWord(word))
  ipcMain.handle('word:removeFromHistory',  (_, word: string) => db.removeFromHistory(word))
  ipcMain.handle('word:unsave',             (_, word: string) => db.unsaveWord(word))
  ipcMain.handle('word:history',     (_, locale: Locale, limit = 30)    => db.getHistory(limit, locale))
  ipcMain.handle('word:saved',       (_, locale: Locale)                 => db.getSaved(locale))

  ipcMain.on('window:close',      () => win.hide())
  ipcMain.on('window:minimize',   () => win.minimize())
  ipcMain.on('window:resize',     (_e, state: 'idle' | 'result') => {
    const height = state === 'idle' ? 60 : 420
    // Windows + transparent + resizable:false = setSize is ignored.
    // Workaround: temporarily allow resize, apply, then lock again.
    win.setResizable(true)
    win.setSize(600, height)
    win.setResizable(false)
  })
  ipcMain.on('update:install-now', () => quitAndInstall())

  // Settings
  ipcMain.handle('settings:getApiKey', () => db.getApiKey())
  ipcMain.handle('settings:setApiKey', (_, key: string) => db.setApiKey(key))
  ipcMain.handle('app:getVersion',     () => require('electron').app.getVersion())
}
