// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'
import type { LexioAPI } from '../types'

const api: LexioAPI = {
  getWord:        (word, locale)        => ipcRenderer.invoke('word:get', word, locale),
  saveWord:       (data, locale)        => ipcRenderer.invoke('word:save', data, locale),
  toggleSaved:    (word)                => ipcRenderer.invoke('word:toggleSaved', word),
  deleteWord:         (word) => ipcRenderer.invoke('word:delete', word),
  removeFromHistory:  (word) => ipcRenderer.invoke('word:removeFromHistory', word),
  unsaveWord:         (word) => ipcRenderer.invoke('word:unsave', word),
  getHistory:     (locale, limit = 30)  => ipcRenderer.invoke('word:history', locale, limit),
  getSaved:       (locale)              => ipcRenderer.invoke('word:saved', locale),
  closeWindow:    ()                    => ipcRenderer.send('window:close'),
  minimizeWindow: ()                    => ipcRenderer.send('window:minimize'),
  resizeWindow:   (state)               => ipcRenderer.send('window:resize', state),
  getApiKey:      ()                    => ipcRenderer.invoke('settings:getApiKey'),
  setApiKey:      (key)                 => ipcRenderer.invoke('settings:setApiKey', key),
  getAppVersion:  ()                    => ipcRenderer.invoke('app:getVersion'),
  onUpdateAvailable:  (cb) => ipcRenderer.on('update:available',  (_, v) => cb(v)),
  onUpdateProgress:   (cb) => ipcRenderer.on('update:progress',   (_, p) => cb(p)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update:downloaded', (_, v) => cb(v)),
  installUpdate:      ()   => ipcRenderer.send('update:install-now'),
}

contextBridge.exposeInMainWorld('lexio', api)
