import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

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

// `npm run build:single` produces one self-contained index.html (offline demo, no API).
export default defineConfig(({ mode, command }) => {
  if (command === 'serve') {
    // Server-only secrets (GEMINI_API_KEY…) go to process.env, never to import.meta.env.
    const env = loadEnv(mode, process.cwd(), '')
    for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v
  }
  return {
    base: './',
    plugins: [apiServerPlugin(), react(), tailwindcss(), ...(mode === 'single' ? [viteSingleFile()] : [])],
    build:
      mode === 'single'
        ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 10_000 }
        : { chunkSizeWarningLimit: 2_000 },
  }
})
