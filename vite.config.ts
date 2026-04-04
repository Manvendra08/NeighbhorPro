import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) return 'firebase-vendor'
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
