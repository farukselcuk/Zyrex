import { contextBridge, ipcRenderer } from 'electron'

// ─── Type Definitions ──────────────────────────────────────────────────────────
// These types are mirrored in src/types/index.ts for the renderer

export interface DirEntry {
  name: string
  path: string
  isDirectory: boolean
}

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
  git: {
    status: (cwd: string) => Promise<{ branch: string; files: Array<{ status: string; path: string }>; error: string | null }>
    diff: (cwd: string, filePath?: string) => Promise<string>
    diffStaged: (cwd: string, filePath?: string) => Promise<string>
    stage: (cwd: string, filePaths: string[]) => Promise<{ success: boolean; error?: string }>
    unstage: (cwd: string, filePaths: string[]) => Promise<{ success: boolean; error?: string }>
    commit: (cwd: string, message: string) => Promise<{ success: boolean; output?: string; error?: string }>
    log: (cwd: string, maxCount?: number) => Promise<Array<{ hash: string; author: string; email: string; timestamp: number; message: string }>>
    branches: (cwd: string) => Promise<Array<{ name: string; current: boolean }>>
    checkout: (cwd: string, branch: string) => Promise<{ success: boolean; error?: string }>
    push: (cwd: string) => Promise<{ success: boolean; output?: string; error?: string }>
    pull: (cwd: string) => Promise<{ success: boolean; output?: string; error?: string }>
    discard: (cwd: string, filePath: string) => Promise<{ success: boolean; error?: string }>
  }
  on: (channel: string, callback: (...args: unknown[]) => void) => void
  off: (channel: string, callback: (...args: unknown[]) => void) => void
}

// ─── Allowed IPC Channels ─────────────────────────────────────────────────────

const ALLOWED_CHANNELS = ['backend:port', 'terminal:data', 'terminal:exit'] as const

// ─── Expose API ───────────────────────────────────────────────────────────────

const nexusAPI: NexusAPI = {
  fs: {
    openFolder: () => ipcRenderer.invoke('fs:openFolder'),
    openFile: () => ipcRenderer.invoke('fs:openFile'),
    saveFile: () => ipcRenderer.invoke('fs:saveFile'),
    readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
    writeFile: (path, content) => ipcRenderer.invoke('fs:writeFile', path, content),
    readDir: (path) => ipcRenderer.invoke('fs:readDir', path),
    createFile: (path) => ipcRenderer.invoke('fs:createFile', path),
    createDir: (path) => ipcRenderer.invoke('fs:createDir', path),
    deleteEntry: (path) => ipcRenderer.invoke('fs:deleteEntry', path),
    rename: (oldPath, newPath) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
    exists: (path) => ipcRenderer.invoke('fs:exists', path),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getBackendPort: () => ipcRenderer.invoke('app:getBackendPort'),
    openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
    showItemInFolder: (path) => ipcRenderer.invoke('app:showItemInFolder', path),
  },
  terminal: {
    spawn: (id, cwd) => ipcRenderer.invoke('terminal:spawn', id, cwd),
    write: (id, data) => ipcRenderer.invoke('terminal:write', id, data),
    resize: (id, cols, rows) => ipcRenderer.invoke('terminal:resize', id, cols, rows),
    kill: (id) => ipcRenderer.invoke('terminal:kill', id),
  },
  search: {
    inFiles: (rootDir, query) => ipcRenderer.invoke('search:inFiles', rootDir, query),
  },
  git: {
    status: (cwd: string) => ipcRenderer.invoke('git:status', cwd),
    diff: (cwd: string, filePath?: string) => ipcRenderer.invoke('git:diff', cwd, filePath),
    diffStaged: (cwd: string, filePath?: string) => ipcRenderer.invoke('git:diffStaged', cwd, filePath),
    stage: (cwd: string, filePaths: string[]) => ipcRenderer.invoke('git:stage', cwd, filePaths),
    unstage: (cwd: string, filePaths: string[]) => ipcRenderer.invoke('git:unstage', cwd, filePaths),
    commit: (cwd: string, message: string) => ipcRenderer.invoke('git:commit', cwd, message),
    log: (cwd: string, maxCount?: number) => ipcRenderer.invoke('git:log', cwd, maxCount),
    branches: (cwd: string) => ipcRenderer.invoke('git:branches', cwd),
    checkout: (cwd: string, branch: string) => ipcRenderer.invoke('git:checkout', cwd, branch),
    push: (cwd: string) => ipcRenderer.invoke('git:push', cwd),
    pull: (cwd: string) => ipcRenderer.invoke('git:pull', cwd),
    discard: (cwd: string, filePath: string) => ipcRenderer.invoke('git:discard', cwd, filePath),
  },
  // Safe event listener — only whitelisted channels
  on: (channel, callback) => {
    if (ALLOWED_CHANNELS.includes(channel as (typeof ALLOWED_CHANNELS)[number])) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args))
    }
  },
  off: (channel, callback) => {
    if (ALLOWED_CHANNELS.includes(channel as (typeof ALLOWED_CHANNELS)[number])) {
      ipcRenderer.removeListener(channel, callback as Parameters<typeof ipcRenderer.removeListener>[1])
    }
  },
}

contextBridge.exposeInMainWorld('nexusAPI', nexusAPI)

// Note: Window type augmentation lives in src/types/index.ts for the renderer.
// Preload runs in a separate context and does not share those types at runtime.
