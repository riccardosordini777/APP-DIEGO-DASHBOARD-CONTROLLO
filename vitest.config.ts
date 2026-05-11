import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    exclude: [
      'node_modules',
      'dist',
      'tests', // Esclude cartella Playwright tests
      '**/*.spec.playwright.ts', // Esclude file Playwright specifici
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
