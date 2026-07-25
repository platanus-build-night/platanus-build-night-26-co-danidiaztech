import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // @excalidraw/excalidraw ships a preact-compatible build guarded by this flag.
  define: {
    'process.env.IS_PREACT': JSON.stringify('true'),
  },
  resolve: {
    alias: {
      // `es6-promise-pool` is a UMD bundle that assigns its constructor to
      // `module.exports` with no `.default`. Vite 8 / Rolldown doesn't apply
      // the CJS interop shim for it, so Excalidraw's
      // `import Pool from "es6-promise-pool"` lands on `undefined` and throws
      // "import_es6_promise_pool.default is not a constructor" the moment the
      // Draw tab mounts. optimizeDeps.include and .needsInterop both failed to
      // fix it; this swaps in a small ESM equivalent instead. See the shim.
      'es6-promise-pool': fileURLToPath(new URL('./src/shims/es6-promise-pool.ts', import.meta.url)),
    },
  },
  optimizeDeps: {
    // Excalidraw is React.lazy()'d, so Vite meets it mid-session and
    // re-optimizes on the fly; naming it here keeps that off the critical path.
    include: ['@excalidraw/excalidraw'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
