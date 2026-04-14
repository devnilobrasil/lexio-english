import { describe, it, expect } from 'vitest'
import { bubblePosition, dialogPosition, BTN_SIZE, DIALOG_WIDTH, DIALOG_HEIGHT } from '../positioning'

const SW = 1920  // screen width
const SH = 1080  // screen height

// ── bubblePosition ────────────────────────────────────────────────────────────

describe('bubblePosition', () => {
  it('coloca o bubble com offset de 12px do cursor por padrão', () => {
    const { x, y } = bubblePosition(500, 400, SW, SH)
    expect(x).toBe(512)
    expect(y).toBe(412)
  })

  it('clampa X quando cursor está próximo da borda direita', () => {
    const { x } = bubblePosition(1900, 400, SW, SH)
    expect(x).toBeLessThanOrEqual(SW - BTN_SIZE - 8)
  })

  it('clampa Y quando cursor está próximo da borda inferior', () => {
    const { y } = bubblePosition(500, 1060, SW, SH)
    expect(y).toBeLessThanOrEqual(SH - BTN_SIZE - 8)
  })

  it('posição mínima é 0 (nunca negativa)', () => {
    const { x, y } = bubblePosition(0, 0, SW, SH)
    expect(x).toBeGreaterThanOrEqual(0)
    expect(y).toBeGreaterThanOrEqual(0)
  })
})

// ── dialogPosition ────────────────────────────────────────────────────────────

describe('dialogPosition', () => {
  it('posiciona na mesma coordenada do cursor quando há espaço suficiente', () => {
    const { x, y } = dialogPosition(500, 400, SW, SH)
    expect(x).toBe(500)
    expect(y).toBe(400)
  })

  it('espelha à esquerda quando dialog sairia pela borda direita', () => {
    // cursor at x=1800: 1800 + DIALOG_WIDTH(360) + 8 > 1920
    const { x } = dialogPosition(1800, 400, SW, SH)
    expect(x).toBe(Math.max(8, 1800 - DIALOG_WIDTH + BTN_SIZE))
    expect(x).toBeLessThan(1800)
  })

  it('sobe quando dialog sairia pela borda inferior', () => {
    // cursor at y=980: 980 + DIALOG_HEIGHT(120) + 8 > 1080
    const { y } = dialogPosition(500, 980, SW, SH)
    expect(y).toBe(Math.max(8, 980 - DIALOG_HEIGHT + BTN_SIZE))
    expect(y).toBeLessThan(980)
  })

  it('flipa horizontal e vertical quando no canto inferior direito', () => {
    const { x, y } = dialogPosition(1850, 1000, SW, SH)
    expect(x).toBeLessThan(1850)
    expect(y).toBeLessThan(1000)
  })

  it('posição mínima é 8px (margem de segurança)', () => {
    // Extreme: cursor at 0,0 with tiny screen
    const { x, y } = dialogPosition(0, 0, 100, 100)
    expect(x).toBeGreaterThanOrEqual(8)
    expect(y).toBeGreaterThanOrEqual(8)
  })
})

// ── constants sanity ──────────────────────────────────────────────────────────

describe('dimension constants', () => {
  it('dialog é maior que o botão', () => {
    expect(DIALOG_WIDTH).toBeGreaterThan(BTN_SIZE)
    expect(DIALOG_HEIGHT).toBeGreaterThan(BTN_SIZE)
  })
})
