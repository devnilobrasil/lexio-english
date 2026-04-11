import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/renderer/test/setup.ts'],
    include: ['src/renderer/**/*.test.ts', 'src/renderer/**/*.test.tsx'],
  },
})
