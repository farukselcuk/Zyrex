import express, { type Application } from 'express'
import cors from 'cors'
import { createServer, type Server } from 'http'
import { aiRouter } from './ai'
import { ragRouter } from './rag'

let httpServer: Server | null = null

export async function startBackendServer(port = 3001): Promise<number> {
  const app: Application = express()

  // ── Middleware ──────────────────────────────────────────────────────────────
  // Only accept requests from localhost (Electron renderer)
  app.use(
    cors({
      origin: ['http://localhost:*', 'http://127.0.0.1:*'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  )
  app.use(express.json({ limit: '10mb' }))

  // ── Health Check ────────────────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '0.1.0', timestamp: Date.now() })
  })

  // ── AI Routes ──────────────────────────────────────────────────────────────
  app.use('/api/ai', aiRouter)

  // ── RAG Routes ─────────────────────────────────────────────────────────────
  app.use('/api/rag', ragRouter)

  // ── Settings Routes (Phase 5) ───────────────────────────────────────────────
  // app.use('/api/settings', dbRouter)

  // ── 404 Handler ─────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  // ── Start Server ─────────────────────────────────────────────────────────────
  return new Promise((resolve, reject) => {
    httpServer = createServer(app)

    httpServer.listen(port, '127.0.0.1', () => {
      resolve(port)
    })

    httpServer.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        // Try next port
        httpServer?.close()
        startBackendServer(port + 1).then(resolve).catch(reject)
      } else {
        reject(err)
      }
    })
  })
}

export function stopBackendServer(): void {
  httpServer?.close()
  httpServer = null
}
