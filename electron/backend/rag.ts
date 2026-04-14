/**
 * rag.ts — Lightweight RAG (Retrieval-Augmented Generation) Context Engine
 *
 * Indexes project files using TF-IDF and provides relevant code context
 * for AI queries. No external vector DB needed — runs entirely in-process.
 *
 * Routes:
 * - POST /api/rag/index   — index a project directory
 * - POST /api/rag/query   — retrieve relevant chunks for a query
 * - GET  /api/rag/status  — get index status
 */

import { Router, type Request, type Response } from 'express'
import fs from 'fs/promises'
import path from 'path'

export const ragRouter = Router()

// ─── Types ────────────────────────────────────────────────────────────────────

interface FileChunk {
  filePath: string
  relativePath: string
  content: string
  startLine: number
  endLine: number
  language: string
  tokens: string[]
}

interface IndexStatus {
  isIndexing: boolean
  totalFiles: number
  totalChunks: number
  lastIndexed: number | null
  projectPath: string | null
}

// ─── State ────────────────────────────────────────────────────────────────────

let chunks: FileChunk[] = []
let idfCache: Map<string, number> = new Map()
let status: IndexStatus = {
  isIndexing: false,
  totalFiles: 0,
  totalChunks: 0,
  lastIndexed: null,
  projectPath: null,
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 50 // lines per chunk
const CHUNK_OVERLAP = 10 // overlapping lines
const MAX_FILE_SIZE = 500_000 // 500KB per file
const MAX_FILES = 5000

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java', '.cpp', '.cc',
  '.c', '.h', '.hpp', '.cs', '.rb', '.php', '.swift', '.kt', '.scala',
  '.html', '.css', '.scss', '.less', '.json', '.yaml', '.yml', '.toml',
  '.md', '.sql', '.sh', '.bash', '.zsh', '.ps1', '.bat',
  '.vue', '.svelte', '.astro', '.prisma', '.graphql', '.gql',
  '.dockerfile', '.env', '.gitignore', '.editorconfig',
])

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'out', 'build', '.next', '.nuxt',
  '__pycache__', '.pytest_cache', 'target', 'vendor', '.vscode',
  'coverage', '.cache', '.turbo', '.parcel-cache',
])

// ─── Tokenization ─────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_$]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && t.length <= 50)
}

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'typescriptreact',
    '.js': 'javascript', '.jsx': 'javascriptreact',
    '.py': 'python', '.rs': 'rust', '.go': 'go',
    '.java': 'java', '.cpp': 'cpp', '.c': 'c',
    '.cs': 'csharp', '.html': 'html', '.css': 'css',
    '.scss': 'scss', '.json': 'json', '.yaml': 'yaml',
    '.yml': 'yaml', '.md': 'markdown', '.sql': 'sql',
    '.sh': 'shell', '.rb': 'ruby', '.php': 'php',
  }
  return map[ext] ?? 'plaintext'
}

// ─── File Discovery ───────────────────────────────────────────────────────────

async function discoverFiles(rootDir: string): Promise<string[]> {
  const files: string[] = []

  async function walk(dir: string): Promise<void> {
    if (files.length >= MAX_FILES) return
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (files.length >= MAX_FILES) return
      if (entry.name.startsWith('.') && !entry.name.startsWith('.env')) continue
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) await walk(fullPath)
      } else {
        const ext = path.extname(entry.name).toLowerCase()
        if (CODE_EXTENSIONS.has(ext) || entry.name === 'Dockerfile' || entry.name === 'Makefile') {
          files.push(fullPath)
        }
      }
    }
  }

  await walk(rootDir)
  return files
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

function chunkFile(filePath: string, content: string, rootDir: string): FileChunk[] {
  const lines = content.split('\n')
  const result: FileChunk[] = []
  const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/')
  const language = detectLanguage(filePath)

  for (let i = 0; i < lines.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    const chunkLines = lines.slice(i, i + CHUNK_SIZE)
    const chunkContent = chunkLines.join('\n')
    if (chunkContent.trim().length === 0) continue

    result.push({
      filePath,
      relativePath,
      content: chunkContent,
      startLine: i + 1,
      endLine: Math.min(i + CHUNK_SIZE, lines.length),
      language,
      tokens: tokenize(chunkContent),
    })
  }

  return result
}

// ─── TF-IDF Scoring ───────────────────────────────────────────────────────────

function buildIDF(): void {
  const docFreq = new Map<string, number>()
  const N = chunks.length

  for (const chunk of chunks) {
    const seen = new Set(chunk.tokens)
    for (const token of seen) {
      docFreq.set(token, (docFreq.get(token) || 0) + 1)
    }
  }

  idfCache = new Map()
  for (const [token, df] of docFreq) {
    idfCache.set(token, Math.log((N + 1) / (df + 1)) + 1)
  }
}

function scoreChunk(queryTokens: string[], chunk: FileChunk): number {
  const tokenFreq = new Map<string, number>()
  for (const t of chunk.tokens) {
    tokenFreq.set(t, (tokenFreq.get(t) || 0) + 1)
  }

  let score = 0
  for (const qt of queryTokens) {
    const tf = (tokenFreq.get(qt) || 0) / Math.max(chunk.tokens.length, 1)
    const idf = idfCache.get(qt) || 0
    score += tf * idf
  }

  return score
}

// ─── Routes ───────────────────────────────────────────────────────────────────

ragRouter.post('/index', async (req: Request, res: Response) => {
  const { projectPath } = req.body
  if (!projectPath) {
    res.status(400).json({ error: 'projectPath is required' })
    return
  }

  if (status.isIndexing) {
    res.status(409).json({ error: 'Indexing already in progress' })
    return
  }

  status.isIndexing = true
  status.projectPath = projectPath

  // Run indexing asynchronously
  ;(async () => {
    try {
      const files = await discoverFiles(projectPath)
      const newChunks: FileChunk[] = []

      for (const filePath of files) {
        try {
          const stat = await fs.stat(filePath)
          if (stat.size > MAX_FILE_SIZE) continue
          const content = await fs.readFile(filePath, 'utf-8')
          newChunks.push(...chunkFile(filePath, content, projectPath))
        } catch {
          // skip unreadable files
        }
      }

      chunks = newChunks
      buildIDF()
      status.totalFiles = files.length
      status.totalChunks = chunks.length
      status.lastIndexed = Date.now()
    } catch (err) {
      console.error('[RAG] Indexing error:', (err as Error).message)
    } finally {
      status.isIndexing = false
    }
  })()

  res.json({ message: 'Indexing started', totalFiles: 'calculating...' })
})

ragRouter.post('/query', (req: Request, res: Response) => {
  const { query, topK = 10, language } = req.body
  if (!query) {
    res.status(400).json({ error: 'query is required' })
    return
  }

  if (chunks.length === 0) {
    res.json({ results: [], message: 'No index available. Call /api/rag/index first.' })
    return
  }

  const queryTokens = tokenize(query)

  let searchChunks = chunks
  if (language) {
    searchChunks = chunks.filter((c) => c.language === language)
    if (searchChunks.length === 0) searchChunks = chunks
  }

  const scored = searchChunks
    .map((chunk) => ({
      chunk,
      score: scoreChunk(queryTokens, chunk),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  res.json({
    results: scored.map((s) => ({
      filePath: s.chunk.relativePath,
      startLine: s.chunk.startLine,
      endLine: s.chunk.endLine,
      language: s.chunk.language,
      content: s.chunk.content,
      score: Math.round(s.score * 1000) / 1000,
    })),
  })
})

ragRouter.get('/status', (_req: Request, res: Response) => {
  res.json(status)
})
