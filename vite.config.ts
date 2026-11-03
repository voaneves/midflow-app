import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

/** Serves the /api routes inside `npm run dev`, so front-end and API share one origin. */
function apiServerPlugin(): Plugin {
  return {
    name: 'midflow-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        // Imported lazily so server/config.ts reads process.env after .env was loaded below.
        const { handleApiRequest } = await import('./server/routes.ts')
        if (!(await handleApiRequest(req, res))) next()
      })
    },
  }
}

/**
 * Emits sw.js with the exact list of hashed app-shell files (JS, CSS, fonts) plus icons.
 * Photos are left out of the precache (≈1.5 MB) and cached when first shown instead.
 */
function pwaPlugin(): Plugin {
  return {
    name: 'midflow-pwa',
    apply: 'build',
    generateBundle(_, bundle) {
      const shell = Object.keys(bundle).filter((f) => /\.(js|css|woff2)$/.test(f))
      const precache = ['./', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', ...shell.map((f) => `./${f}`)].sort()
      const version = createHash('sha256').update(precache.join('\n')).digest('hex').slice(0, 10)
      const source = readFileSync('src/pwa/sw.js', 'utf8').replace('__VERSION__', JSON.stringify(version)).replace('__PRECACHE__', JSON.stringify(precache))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

/**
 * index.html ships a CSP <meta>. Dev needs an inline react-refresh preamble and an HMR websocket,
 * and the single-file build inlines its scripts; both would be blocked, so the meta is dropped there.
 */
function stripCspMetaPlugin(): Plugin {
  return {
    name: 'midflow-strip-csp-meta',
    transformIndexHtml(html) {
      return html.replace(/\s*<meta\s[^>]*http-equiv="Content-Security-Policy"[^>]*\/?>/i, '')
    },
  }
}

// `npm run build:single` produces one self-contained index.html (offline demo, no API).
export default defineConfig(({ mode, command }) => {
  if (command === 'serve') {
    // Server-only secrets (GEMINI_API_KEY…) go to process.env, never to import.meta.env.
    const env = loadEnv(mode, process.cwd(), '')
    for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v
  }
  const stripCsp = command === 'serve' || mode === 'single'
  return {
    base: './',
    plugins: [
      apiServerPlugin(),
      react(),
      tailwindcss(),
      ...(stripCsp ? [stripCspMetaPlugin()] : []),
      ...(mode === 'single' ? [viteSingleFile()] : [pwaPlugin()]),
    ],
    build:
      mode === 'single'
        ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 10_000 }
        : {
            chunkSizeWarningLimit: 2_000,
            // One shared icon chunk instead of dozens of sub-1 KB files per route.
            rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'icons', test: /lucide-react/ }] } } },
          },
  }
})
