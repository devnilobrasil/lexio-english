import { describe, it, expect } from 'vitest'
import { resizeStateFor } from '../appMode'

describe('resizeStateFor', () => {
  it('returns translate when appMode is translate', () => {
    expect(resizeStateFor('translate', 'idle')).toBe('translate')
    expect(resizeStateFor('translate', 'result')).toBe('translate')
  })

  it('returns dictionary windowState when appMode is dictionary', () => {
    expect(resizeStateFor('dictionary', 'idle')).toBe('idle')
    expect(resizeStateFor('dictionary', 'result')).toBe('result')
  })
})
