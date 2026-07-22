vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }))
vi.mock('../lib/tauri-bridge', () => ({
  invoke: vi.fn(() => Promise.resolve()),
}))

import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listen } from '@tauri-apps/api/event'
import { useAppMode } from '../useAppMode'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listen).mockImplementation(() => Promise.resolve(() => {}))
})

describe('useAppMode', () => {
  it('registers assistant listeners only once across resize identity changes', async () => {
    const resizeA = vi.fn()
    const { rerender } = renderHook(
      ({ resize }) => useAppMode(resize, 'idle'),
      { initialProps: { resize: resizeA } },
    )

    await waitFor(() => {
      expect(listen).toHaveBeenCalled()
    })
    const callsAfterMount = vi.mocked(listen).mock.calls.length
    expect(callsAfterMount).toBe(3)

    const resizeB = vi.fn()
    rerender({ resize: resizeB })

    expect(vi.mocked(listen).mock.calls.length).toBe(callsAfterMount)
  })
})
