import { fileURLToPath } from 'url'
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const root = fileURLToPath(new URL('.', import.meta.url))

// Paketeeritud rakenduses ei tee renderer ise võrgupäringuid, need käivad main protsessis.
const productionCsp = {
  name: 'production-csp',
  apply: 'build',
  transformIndexHtml(html) {
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'"
    ].join('; ')
    return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`)
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(root, 'electron/main.js') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(root, 'electron/preload.js') }
      }
    }
  },
  renderer: {
    root,
    // Relative asset paths, because the packaged app opens index.html from disk (file://)
    base: './',
    plugins: [react(), tailwindcss(), productionCsp],
    build: {
      // electron/main.js loads ../dist/index.html and electron-builder ships dist/**,
      // so the UI must be built into dist (electron-vite's default is out/renderer)
      outDir: resolve(root, 'dist'),
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(root, 'index.html')
      }
    }
  }
})
