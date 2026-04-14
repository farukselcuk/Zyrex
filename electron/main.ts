import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { startBackendServer } from './backend/server'
import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'

// ─── node-pty (optional native module) ────────────────────────────────────────

let pty: typeof import('node-pty') | null = null
try {
  pty = require('node-pty')
} catch {
  console.warn('[NexusIDE] node-pty not available — terminal will be disabled')
}

const ptyProcesses = new Map<string, import('node-pty').IPty>()

let mainWindow: BrowserWindow | null = null
let backendPort = 3001

// ─── Window Factory ──────────────────────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Open external links in the OS browser, not in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Pass backend port to renderer via env
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('backend:port', backendPort)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  // ── File System ──────────────────────────────────────────────────────────

  ipcMain.handle('fs:openFolder', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Open Project Folder',
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('fs:openFile', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      title: 'Open File',
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'TypeScript', extensions: ['ts', 'tsx'] },
        { name: 'JavaScript', extensions: ['js', 'jsx'] },
        { name: 'Python', extensions: ['py'] },
        { name: 'Rust', extensions: ['rs'] },
        { name: 'Markdown', extensions: ['md'] },
        { name: 'JSON', extensions: ['json'] },
      ],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('fs:saveFile', async () => {
    if (!mainWindow) return null
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save File',
    })
    return result.canceled ? null : result.filePath
  })

  ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    return fs.readFile(filePath, 'utf-8')
  })

  ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
    await fs.writeFile(filePath, content, 'utf-8')
    return true
  })

  ipcMain.handle('fs:readDir', async (_event, dirPath: string) => {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries
      .filter((e) => !e.name.startsWith('.') || e.name === '.env')
      .map((entry) => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        isDirectory: entry.isDirectory(),
      }))
      .sort((a, b) => {
        // Directories first, then files, both alphabetically
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  })

  ipcMain.handle('fs:createFile', async (_event, filePath: string) => {
    await fs.writeFile(filePath, '', 'utf-8')
    return true
  })

  ipcMain.handle('fs:createDir', async (_event, dirPath: string) => {
    await fs.mkdir(dirPath, { recursive: true })
    return true
  })

  ipcMain.handle('fs:deleteEntry', async (_event, entryPath: string) => {
    await fs.rm(entryPath, { recursive: true, force: true })
    return true
  })

  ipcMain.handle('fs:rename', async (_event, oldPath: string, newPath: string) => {
    await fs.rename(oldPath, newPath)
    return true
  })

  ipcMain.handle('fs:exists', async (_event, entryPath: string) => {
    try {
      await fs.access(entryPath)
      return true
    } catch {
      return false
    }
  })

  // ── App ───────────────────────────────────────────────────────────────────

  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('app:getBackendPort', () => backendPort)

  ipcMain.handle('app:openExternal', async (_event, url: string) => {
    // Only allow http/https/file URLs
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file:///')) return false
    await shell.openExternal(url)
    return true
  })

  ipcMain.handle('app:showItemInFolder', async (_event, itemPath: string) => {
    shell.showItemInFolder(itemPath)
  })

  // ── Terminal (node-pty) ──────────────────────────────────────────────────

  ipcMain.handle('terminal:spawn', async (_event, id: string, cwd?: string) => {
    if (!pty) return { success: false, error: 'node-pty not available' }
    const shellPath = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash')
    const proc = pty.spawn(shellPath, [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: cwd || process.env.HOME || process.cwd(),
      env: process.env as Record<string, string>,
    })
    ptyProcesses.set(id, proc)
    proc.onData((data: string) => {
      mainWindow?.webContents.send('terminal:data', id, data)
    })
    proc.onExit(({ exitCode }) => {
      ptyProcesses.delete(id)
      mainWindow?.webContents.send('terminal:exit', id, exitCode)
    })
    return { success: true }
  })

  ipcMain.handle('terminal:write', async (_event, id: string, data: string) => {
    ptyProcesses.get(id)?.write(data)
  })

  ipcMain.handle('terminal:resize', async (_event, id: string, cols: number, rows: number) => {
    ptyProcesses.get(id)?.resize(cols, rows)
  })

  ipcMain.handle('terminal:kill', async (_event, id: string) => {
    const proc = ptyProcesses.get(id)
    if (proc) {
      proc.kill()
      ptyProcesses.delete(id)
    }
  })

  // ── Search (ripgrep-style using findstr / grep) ──────────────────────────

  ipcMain.handle('search:inFiles', async (_event, rootDir: string, query: string) => {
    if (!query || !rootDir) return []
    try {
      const cmd = process.platform === 'win32'
        ? `findstr /S /I /N /P "${query.replace(/"/g, '')}" "${rootDir}\\*.*"`
        : `grep -rn --include='*' -i "${query.replace(/"/g, '')}" "${rootDir}"`
      const output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024, timeout: 10000 })
      const results: Array<{ file: string; line: number; text: string }> = []
      for (const line of output.split('\n').slice(0, 200)) {
        const match = line.match(/^(.+?):(\d+):(.*)$/)
        if (match) {
          results.push({ file: match[1], line: parseInt(match[2]), text: match[3].trim() })
        }
      }
      return results
    } catch {
      return []
    }
  })
}

// ─── App Lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.nexuside.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Remove default menu in production
  if (!is.dev) {
    Menu.setApplicationMenu(null)
  }

  // Start the Express backend inside the main process
  try {
    backendPort = await startBackendServer()
    console.log(`[NexusIDE] Backend running on http://127.0.0.1:${backendPort}`)
  } catch (err) {
    console.error('[NexusIDE] Failed to start backend server:', err)
  }

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
