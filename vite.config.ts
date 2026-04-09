import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
  },
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase/firestore')) return 'firebase-firestore'
            if (id.includes('firebase/auth')) return 'firebase-auth'
            if (id.includes('firebase/messaging')) return 'firebase-messaging'
            if (id.includes('firebase')) return 'firebase-core'
            if (id.includes('react') || id.includes('scheduler')) return 'react-vendor'
            return 'vendor'
          }

          if (id.includes('/src/components/')) return 'components'

          return undefined
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    pool: "threads",
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
    setupFiles: "./src/test/setup.ts",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
      include: [
        "src/services/loyaltyService.ts",
        "src/lib/validation.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 60,
        functions: 80,
        lines: 80,
      },
    },
  },
})
