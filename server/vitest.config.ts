import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'build', 'dist', '.git'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'build/',
        'dist/',
        '**/*.{test,spec}.{js,ts}',
        '**/*.config.{js,ts}',
        'coverage/',
      ],
    },
  },
  resolve: {
    alias: {
      // Handle .js imports in TypeScript files for ES modules
      '@/': new URL('./', import.meta.url).pathname,
    },
  },
  esbuild: {
    target: 'node18',
  },
})