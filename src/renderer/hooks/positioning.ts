// src/renderer/hooks/positioning.ts
//
// Pure functions for calculating overlay window placement.
// All functions are side-effect-free and easily unit-testable.

export const BTN_SIZE = 48
export const DIALOG_WIDTH = 360   // 48 btn + 8 gap + 304 dialog
export const DIALOG_HEIGHT = 120  // row layout — more compact than column

const MARGIN = 8
const CURSOR_OFFSET = 12

/**
 * Position for the bubble (BTN_SIZE × BTN_SIZE) relative to the cursor.
 * Clamped to always stay within the screen with MARGIN breathing room.
 */
export function bubblePosition(
  cursorX: number,
  cursorY: number,
  screenWidth: number,
  screenHeight: number,
): { x: number; y: number } {
  return {
    x: Math.min(cursorX + CURSOR_OFFSET, screenWidth - BTN_SIZE - MARGIN),
    y: Math.min(cursorY + CURSOR_OFFSET, screenHeight - BTN_SIZE - MARGIN),
  }
}

/**
 * Position for the overlay when the dialog is open (DIALOG_WIDTH × DIALOG_HEIGHT).
 *
 * Default: same (x, y) as the bubble — the dialog grows to the right and downward.
 * Flip left:  if the dialog would go past the right edge of the screen.
 * Flip up:    if the dialog would go past the bottom edge of the screen.
 */
export function dialogPosition(
  cursorX: number,
  cursorY: number,
  screenWidth: number,
  screenHeight: number,
): { x: number; y: number } {
  const goesRight = cursorX + DIALOG_WIDTH + MARGIN > screenWidth
  const goesDown = cursorY + DIALOG_HEIGHT + MARGIN > screenHeight

  const x = goesRight
    ? Math.max(MARGIN, cursorX - DIALOG_WIDTH + BTN_SIZE)
    : cursorX

  const y = goesDown
    ? Math.max(MARGIN, cursorY - DIALOG_HEIGHT + BTN_SIZE)
    : cursorY

  return { x, y }
}
