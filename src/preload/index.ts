// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'
import type { LexioAPI } from '../types'

const api: LexioAPI = {
  getWord:        (word)        => ipcRenderer.invoke('word:get', word),
  saveWord:       (data)        => ipcRenderer.invoke('word:save', data),
  toggleSaved:    (word)        => ipcRenderer.invoke('word:toggleSaved', word),
  deleteWord:     (word)        => ipcRenderer.invoke('word:delete', word),
  getHistory:     (limit = 30)  => ipcRenderer.invoke('word:history', limit),
  getSaved:       ()            => ipcRenderer.invoke('word:saved'),
  closeWindow:    ()            => ipcRenderer.send('window:close'),
  minimizeWindow: ()            => ipcRenderer.send('window:minimize'),
}

contextBridge.exposeInMainWorld('lexio', api)
