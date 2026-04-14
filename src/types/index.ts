// ─── File System ──────────────────────────────────────────────────────────────

export interface DirEntry {
  name: string
  path: string
  isDirectory: boolean
  children?: DirEntry[] // populated lazily
}

// ─── Editor Tabs ──────────────────────────────────────────────────────────────

export type TabLanguage =
  | 'typescript'
  | 'javascript'
  | 'typescriptreact'
  | 'javascriptreact'
  | 'python'
  | 'rust'
  | 'go'
  | 'java'
  | 'cpp'
  | 'c'
  | 'csharp'
  | 'html'
  | 'css'
  | 'scss'
  | 'json'
  | 'yaml'
  | 'toml'
  | 'markdown'
  | 'shell'
  | 'sql'
  | 'plaintext'

export interface EditorTab {
  id: string
  /** Absolute file path, or undefined for unsaved buffers */
  path: string | undefined
  name: string
  content: string
  originalContent: string // for dirty-detection
  language: TabLanguage
  isDirty: boolean
  /** Cursor position to restore on tab switch */
  cursorPosition?: { lineNumber: number; column: number }
}

// ─── AI / Chat ────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: number
  isStreaming?: boolean
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  model: string
  createdAt: number
  updatedAt: number
}

// ─── Models ───────────────────────────────────────────────────────────────────

export type ModelProvider = 'openai' | 'anthropic' | 'google' | 'groq' | 'ollama'

export interface AIModel {
  id: string
  name: string
  provider: ModelProvider
  contextWindow?: number
  description?: string
}

export const AVAILABLE_MODELS: AIModel[] = [
  // OpenAI
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', contextWindow: 128000 },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', contextWindow: 128000 },
  { id: 'o1', name: 'o1', provider: 'openai', contextWindow: 200000 },
  { id: 'o3-mini', name: 'o3 Mini', provider: 'openai', contextWindow: 200000 },
  // Anthropic
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', contextWindow: 200000 },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic', contextWindow: 200000 },
  { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', provider: 'anthropic', contextWindow: 200000 },
  // Google
  { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', provider: 'google', contextWindow: 1000000 },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', contextWindow: 2000000 },
  // Groq
  { id: 'llama-3.3-70b-versatile', name: 'LLaMA 3.3 70B', provider: 'groq', contextWindow: 128000 },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', provider: 'groq', contextWindow: 32768 },
  // Ollama (local)
  { id: 'ollama/llama3', name: 'LLaMA 3 (Local)', provider: 'ollama' },
  { id: 'ollama/mistral', name: 'Mistral (Local)', provider: 'ollama' },
  { id: 'ollama/phi3', name: 'Phi-3 (Local)', provider: 'ollama' },
  { id: 'ollama/codellama', name: 'CodeLLaMA (Local)', provider: 'ollama' },
]

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface EditorSettings {
  fontSize: number
  fontFamily: string
  tabSize: number
  lineNumbers: boolean
  minimap: boolean
  wordWrap: boolean
  theme: 'vs-dark' | 'light' | 'hc-black'
}

export interface AISettings {
  temperature: number
  maxTokens: number
  systemPrompt: string
  includeOpenFileContext: boolean
}

export interface APIKeys {
  openai?: string
  anthropic?: string
  google?: string
  groq?: string
}

// ─── IPC API type (mirrors electron/preload.ts) ────────────────────────────────

export interface NexusAPI {
  fs: {
    openFolder: () => Promise<string | null>
    openFile: () => Promise<string | null>
    saveFile: () => Promise<string | null>
    readFile: (path: string) => Promise<string>
    writeFile: (path: string, content: string) => Promise<boolean>
    readDir: (path: string) => Promise<DirEntry[]>
    createFile: (path: string) => Promise<boolean>
    createDir: (path: string) => Promise<boolean>
    deleteEntry: (path: string) => Promise<boolean>
    rename: (oldPath: string, newPath: string) => Promise<boolean>
    exists: (path: string) => Promise<boolean>
  }
  app: {
    getVersion: () => Promise<string>
    getBackendPort: () => Promise<number>
    openExternal: (url: string) => Promise<boolean>
    showItemInFolder: (path: string) => Promise<void>
  }
  terminal: {
    spawn: (id: string, cwd?: string) => Promise<{ success: boolean; error?: string }>
    write: (id: string, data: string) => Promise<void>
    resize: (id: string, cols: number, rows: number) => Promise<void>
    kill: (id: string) => Promise<void>
  }
  search: {
    inFiles: (rootDir: string, query: string) => Promise<Array<{ file: string; line: number; text: string }>>
  }
  on: (channel: string, callback: (...args: unknown[]) => void) => void
  off: (channel: string, callback: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    nexusAPI: NexusAPI
  }
}
