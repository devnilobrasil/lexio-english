---
name: tauri-build-deploy
description: Use when building, signing, or releasing the Lexio Tauri app. Covers tauri.conf.json bundle configuration, code signing keys, auto-updater setup with latest.json, and GitHub Actions release workflow.
---

# Tauri Build and Deploy — Lexio

## Overview

Tauri v2 builds produce native installers per platform. Windows targets are `msi` and `nsis`. The auto-updater requires a signing key pair and a `latest.json` published alongside each release.

---

## Dev Commands (post-migration)

```bash
npm run dev              # tauri dev (starts Rust + renderer together)
npm run dev:renderer     # vite only (no Electron, no Rust)
npm run build:renderer   # tsc + vite build (type-check)
npm run build            # tauri build (full production)
npm run build:win        # tauri build --target x86_64-pc-windows-msvc
cd src/tauri && cargo test  # Rust unit tests
npm run test             # Vitest (renderer unit tests)
```

---

## `tauri.conf.json` — Bundle Section

```json
{
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis"],
    "icon": [
      "src/tauri/icons/32x32.png",
      "src/tauri/icons/128x128.png",
      "src/tauri/icons/128x128@2x.png",
      "src/tauri/icons/icon.icns",
      "src/tauri/icons/icon.ico"
    ],
    "windows": {
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  },
  "plugins": {
    "updater": {
      "pubkey": "PASTE_PUBLIC_KEY_HERE",
      "endpoints": [
        "https://github.com/devnilobrasil/lexio/releases/latest/download/latest.json"
      ]
    }
  }
}
```

---

## Code Signing Key Pair

Generate once. Store private key securely — never commit it.

```bash
# Generate key pair
npx tauri signer generate -w ~/.tauri/lexio.key

# Output:
#   Public key:  <paste into tauri.conf.json pubkey>
#   Private key: stored at ~/.tauri/lexio.key
```

Environment variables required to sign during build:
```bash
TAURI_SIGNING_PRIVATE_KEY=<contents of ~/.tauri/lexio.key>
TAURI_SIGNING_PRIVATE_KEY_PASSWORD=<password if set>
```

In GitHub Actions, store as repository secrets.

---

## `latest.json` Structure

Must be published at the URL in `updater.endpoints` with each release:

```json
{
  "version": "1.2.0",
  "notes": "Bug fixes and improvements",
  "pub_date": "2026-04-09T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<contents of lexio_1.2.0_x64-setup.exe.sig>",
      "url": "https://github.com/devnilobrasil/lexio/releases/download/v1.2.0/lexio_1.2.0_x64-setup.exe"
    },
    "darwin-aarch64": {
      "signature": "<contents of Lexio_1.2.0_aarch64.app.tar.gz.sig>",
      "url": "https://github.com/devnilobrasil/lexio/releases/download/v1.2.0/Lexio_1.2.0_aarch64.app.tar.gz"
    }
  }
}
```

The `.sig` file is generated automatically by `tauri build` when the signing key is present.

---

## GitHub Actions Release Workflow

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - uses: dtolnay/rust-toolchain@stable

      - run: npm ci
      - run: npm run build
        env:
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}

      - name: Upload artifacts
        uses: softprops/action-gh-release@v2
        with:
          files: |
            src-tauri/target/release/bundle/msi/*.msi
            src-tauri/target/release/bundle/nsis/*.exe
            src-tauri/target/release/bundle/msi/*.sig
            src-tauri/target/release/bundle/nsis/*.sig
            latest.json
```

---

## Build Output Locations

After `npm run build`:

```
src/tauri/target/release/bundle/
├── msi/
│   ├── lexio_1.0.0_x64_en-US.msi
│   └── lexio_1.0.0_x64_en-US.msi.sig
└── nsis/
    ├── lexio_1.0.0_x64-setup.exe
    └── lexio_1.0.0_x64-setup.exe.sig
```

---

## Icon Generation

Generate all required icon sizes from a single `.png` source:

```bash
npx tauri icon public/logo/icon.png --output src/tauri/icons
```

Source image should be at least 1024×1024 px.

---

## Pre-release Checklist

- [ ] Version bumped in `tauri.conf.json` → `"version"`
- [ ] `cargo test` passes
- [ ] `npm run test` passes
- [ ] `npm run build:renderer` passes (no TypeScript errors)
- [ ] `TAURI_SIGNING_PRIVATE_KEY` available in environment
- [ ] `latest.json` will be published alongside installers
- [ ] Git tag created: `git tag v1.x.x && git push origin v1.x.x`

---

## Common Mistakes

| Mistake | Fix |
|---|---|
| Build fails with "private key not found" | Set `TAURI_SIGNING_PRIVATE_KEY` env var |
| Auto-updater not detecting new version | Check `latest.json` URL is correct and accessible |
| `latest.json` signature mismatch | Regenerate with the correct private key |
| Icons missing in bundled app | Run `tauri icon` to regenerate all sizes |
| `tauri build` without `build:renderer` first | Always run `npm run build:renderer` first to catch TS errors |
