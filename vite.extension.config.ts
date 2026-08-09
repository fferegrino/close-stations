import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/**
 * Bundle the extension service worker so it can import shared/tfl.
 * Output stays at chrome-extension/background.js for load-unpacked.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(rootDir, 'shared'),
    },
  },
  build: {
    emptyOutDir: false,
    outDir: 'chrome-extension',
    lib: {
      entry: path.resolve(rootDir, 'chrome-extension/background.ts'),
      formats: ['es'],
      fileName: () => 'background.js',
    },
    rollupOptions: {
      output: {
        codeSplitting: false,
      },
    },
    minify: false,
    sourcemap: true,
    target: 'esnext',
  },
})
