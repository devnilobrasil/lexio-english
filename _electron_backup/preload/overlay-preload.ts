// src/preload/overlay-preload.ts
import { contextBridge, ipcRenderer } from 'electron'
import type { OverlayAPI } from '../types'

const overlayApi: OverlayAPI = {
  onStateChange: (cb) => { ipcRenderer.on('overlay:state', (_e, s) => cb(s)) },
  onError:       (cb) => { ipcRenderer.on('overlay:error', (_e, m) => cb(m)) },
  translate:     ()          => ipcRenderer.send('overlay:translate'),
  dragStart:     ()          => ipcRenderer.send('overlay:drag-start'),
  setPosition:   (x, y)     => ipcRenderer.send('overlay:set-position', x, y),
}

contextBridge.exposeInMainWorld('lexioOverlay', overlayApi)
