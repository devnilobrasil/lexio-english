// src/main/ipc.ts
import { ipcMain, BrowserWindow } from 'electron'
import * as db from './db'

export function registerIpcHandlers(win: BrowserWindow): void {
  ipcMain.handle('word:get',         (_, word: string)        => db.getWord(word))
  ipcMain.handle('word:save',        (_, data)                => db.upsertWord(data))
  ipcMain.handle('word:toggleSaved', (_, word: string)        => db.toggleSaved(word))
  ipcMain.handle('word:delete',      (_, word: string)        => db.deleteWord(word))
  ipcMain.handle('word:history',     (_, limit: number = 30)  => db.getHistory(limit))
  ipcMain.handle('word:saved',       ()                       => db.getSaved())

  ipcMain.on('window:close',    () => win.hide())
  ipcMain.on('window:minimize', () => win.minimize())
}
