# SESSION — Unify Mode Tabs

**Branch:** `feat/unify-mode-tabs`  
**Base:** `stage` @ `1.4.0`

## Goal

One Lexio window with mode tabs (**Dicionário** | **Traduzir**). Remove the dedicated `assistant` window.

## What changed

- Frontend: `ModeTabs`, `AppShell` hosts both dictionary and `TranslationPanel`
- Resize: `idle` 110, `result` 420, `translate` 320
- Hotkey `Ctrl+Alt+T` shows/focuses `main` and emits `assistant:*` (frontend switches tab)
- Removed: `assistant` window, `overlay.html`, `overlay-main.tsx`, `assistant_close`, `assistant_open_main`, tray "Show Assistant"

## Manual test

See [MANUAL-TESTING.md](./MANUAL-TESTING.md)
