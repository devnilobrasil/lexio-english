// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'
import type { LexioAPI } from '../types'

const api: LexioAPI = {
  getWord:        (word, locale)        => ipcRenderer.invoke('word:get', word, locale),
  saveWord:       (data, locale)        => ipcRenderer.invoke('word:save', data, locale),
  toggleSaved:    (word)                => ipcRenderer.invoke('word:toggleSaved', word),
  deleteWord:     (word)                => ipcRenderer.invoke('word:delete', word),
  getHistory:     (locale, limit = 30)  => ipcRenderer.invoke('word:history', locale, limit),
  getSaved:       (locale)              => ipcRenderer.invoke('word:saved', locale),
  closeWindow:    ()                    => ipcRenderer.send('window:close'),
  minimizeWindow: ()                    => ipcRenderer.send('window:minimize'),
}

contextBridge.exposeInMainWorld('lexio', api)
