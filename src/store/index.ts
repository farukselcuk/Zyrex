import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from './utils/nanoid'
import type {
  EditorTab,
  TabLanguage,
  Conversation,
  ChatMessage,
  AIModel,
  EditorSettings,
  AISettings,
  APIKeys,
} from '../types'
import { AVAILABLE_MODELS } from '../types'

// ─── Helper ───────────────────────────────────────────────────────────────────

function detectLanguage(filename: string): TabLanguage {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, TabLanguage> = {
    ts: 'typescript', tsx: 'typescriptreact',
    js: 'javascript',  jsx: 'javascriptreact',
    py: 'python', rs: 'rust', go: 'go',
    java: 'java', cpp: 'cpp', cc: 'cpp',
    c: 'c', cs: 'csharp',
    html: 'html', css: 'css', scss: 'scss',
    json: 'json', yaml: 'yaml', yml: 'yaml',
    toml: 'toml', md: 'markdown', sh: 'shell',
    bash: 'shell', sql: 'sql',
  }
  return map[ext] ?? 'plaintext'
}

// ─── App Store ────────────────────────────────────────────────────────────────

interface AppState {
  // Layout
  isFileTreeOpen: boolean
  isAIPanelOpen: boolean
  backendPort: number

  // Project
  projectPath: string | null

  // Setters
  toggleFileTree: () => void
  toggleAIPanel: () => void
  setBackendPort: (port: number) => void
  setProjectPath: (path: string | null) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isFileTreeOpen: true,
      isAIPanelOpen: true,
      backendPort: 3001,
      projectPath: null,

      toggleFileTree: () => set((s) => ({ isFileTreeOpen: !s.isFileTreeOpen })),
      toggleAIPanel: () => set((s) => ({ isAIPanelOpen: !s.isAIPanelOpen })),
      setBackendPort: (port) => set({ backendPort: port }),
      setProjectPath: (path) => set({ projectPath: path }),
    }),
    { name: 'nexus-app-layout' },
  ),
)

// ─── Editor / Tabs Store ──────────────────────────────────────────────────────

interface EditorState {
  tabs: EditorTab[]
  activeTabId: string | null

  openTab: (path: string, name: string, content: string) => void
  openNewTab: () => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  updateContent: (id: string, content: string) => void
  markSaved: (id: string) => void
  renameTab: (id: string, name: string) => void
  updateTabPath: (id: string, path: string, name: string) => void
  getActiveTab: () => EditorTab | undefined
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  tabs: [],
  activeTabId: null,

  openTab: (path, name, content) => {
    const existing = get().tabs.find((t) => t.path === path)
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }
    const tab: EditorTab = {
      id: nanoid(),
      path,
      name,
      content,
      originalContent: content,
      language: detectLanguage(name),
      isDirty: false,
    }
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
  },

  openNewTab: () => {
    const id = nanoid()
    const tab: EditorTab = {
      id,
      path: undefined,
      name: 'Untitled',
      content: '',
      originalContent: '',
      language: 'plaintext',
      isDirty: false,
    }
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: id }))
  },

  closeTab: (id) => {
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === id)
      const newTabs = s.tabs.filter((t) => t.id !== id)
      let newActive = s.activeTabId
      if (s.activeTabId === id) {
        // Activate the neigbour tab
        const neighbour = newTabs[idx] ?? newTabs[idx - 1]
        newActive = neighbour?.id ?? null
      }
      return { tabs: newTabs, activeTabId: newActive }
    })
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  updateContent: (id, content) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, content, isDirty: content !== t.originalContent } : t,
      ),
    }))
  },

  markSaved: (id) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, isDirty: false, originalContent: t.content } : t,
      ),
    }))
  },

  renameTab: (id, name) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, name } : t)),
    }))
  },

  updateTabPath: (id, path, name) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id
          ? { ...t, path, name, language: detectLanguage(name), isDirty: false, originalContent: t.content }
          : t,
      ),
    }))
  },

  getActiveTab: () => {
    const { tabs, activeTabId } = get()
    return tabs.find((t) => t.id === activeTabId)
  },
}))

// ─── AI / Chat Store ──────────────────────────────────────────────────────────

interface AIState {
  conversations: Conversation[]
  activeConversationId: string | null
  selectedModel: string
  availableModels: AIModel[]
  apiKeys: APIKeys
  aiSettings: AISettings
  isStreaming: boolean

  setSelectedModel: (model: string) => void
  setApiKey: (provider: keyof APIKeys, key: string) => void
  setAISettings: (settings: Partial<AISettings>) => void
  newConversation: () => string
  addMessage: (conversationId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => string
  updateLastMessage: (conversationId: string, content: string, done?: boolean) => void
  setStreaming: (v: boolean) => void
  getActiveConversation: () => Conversation | undefined
}

const DEFAULT_AI_SETTINGS: AISettings = {
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: 'You are an expert software engineer and AI coding assistant. Help the user write, review, debug, and improve code. Be concise and precise.',
  includeOpenFileContext: true,
}

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      selectedModel: 'gpt-4o',
      availableModels: AVAILABLE_MODELS,
      apiKeys: {},
      aiSettings: DEFAULT_AI_SETTINGS,
      isStreaming: false,

      setSelectedModel: (model) => set({ selectedModel: model }),

      setApiKey: (provider, key) =>
        set((s) => ({ apiKeys: { ...s.apiKeys, [provider]: key } })),

      setAISettings: (settings) =>
        set((s) => ({ aiSettings: { ...s.aiSettings, ...settings } })),

      newConversation: () => {
        const id = nanoid()
        const conv: Conversation = {
          id,
          title: 'New Chat',
          messages: [],
          model: get().selectedModel,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((s) => ({
          conversations: [conv, ...s.conversations],
          activeConversationId: id,
        }))
        return id
      },

      addMessage: (conversationId, message) => {
        const id = nanoid()
        const full: ChatMessage = { ...message, id, timestamp: Date.now() }
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, messages: [...c.messages, full], updatedAt: Date.now() }
              : c,
          ),
        }))
        return id
      },

      updateLastMessage: (conversationId, content, done = false) => {
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c
            const msgs = [...c.messages]
            const lastIdx = msgs.length - 1
            if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant') {
              msgs[lastIdx] = {
                ...msgs[lastIdx],
                content,
                isStreaming: !done,
              }
            }
            return { ...c, messages: msgs, updatedAt: Date.now() }
          }),
        }))
      },

      setStreaming: (v) => set({ isStreaming: v }),

      getActiveConversation: () => {
        const { conversations, activeConversationId } = get()
        return conversations.find((c) => c.id === activeConversationId)
      },
    }),
    {
      name: 'nexus-ai-store',
      // Don't persist streaming state
      partialize: (s) => ({
        ...s,
        isStreaming: false,
        conversations: s.conversations.slice(0, 50), // cap history
      }),
    },
  ),
)

// ─── Editor Settings Store ────────────────────────────────────────────────────

interface EditorSettingsState {
  settings: EditorSettings
  update: (patch: Partial<EditorSettings>) => void
}

const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 14,
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  tabSize: 2,
  lineNumbers: true,
  minimap: false,
  wordWrap: false,
  theme: 'vs-dark',
}

export const useEditorSettings = create<EditorSettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_EDITOR_SETTINGS,
      update: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    { name: 'nexus-editor-settings' },
  ),
)
