import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: { url: 'http://localhost/' },
    },
    include: ['test/unit/**/*.test.ts', 'test/store/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    globals: true,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
  resolve: {
    alias: {
      '@test': new URL('./test/fixtures', import.meta.url).pathname,
    },
  },
})
