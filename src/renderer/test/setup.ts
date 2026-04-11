import { mockIPC, clearMocks } from '@tauri-apps/api/mocks'

beforeEach(() => {
  // Default IPC mock — most tests need these baseline commands to be no-ops
  mockIPC((cmd) => {
    if (cmd === 'get_api_key') return null
    if (cmd === 'get_history') return []
    if (cmd === 'get_saved') return []
  })
})

afterEach(() => {
  clearMocks()
})
