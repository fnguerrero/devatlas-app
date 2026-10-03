/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost:5173/' } },
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Los tests viven al lado de lo que prueban, en src/**/__tests__.
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
