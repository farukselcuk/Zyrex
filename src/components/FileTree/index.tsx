import { useState, useCallback, useRef, useEffect } from 'react'
import { useAppStore, useEditorStore } from '../../store'
import type { DirEntry } from '../../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract parent dir from a file path */
function parentDir(filePath: string): string {
  const sep = filePath.includes('/') ? '/' : '\\'
  const parts = filePath.split(sep)
  parts.pop()
  return parts.join(sep)
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="flex-shrink-0">
      {open ? (
        <path d="M1 4a1 1 0 0 1 1-1h4.586l1.707 1.707A1 1 0 0 0 9 5h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4z" />
      ) : (
        <path d="M1 4a1 1 0 0 1 1-1h4.586l1.707 1.707A1 1 0 0 0 9 5h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4z" />
      )}
    </svg>
  )
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase()
  const color =
    ext === 'ts' || ext === 'tsx' ? 'text-blue' :
    ext === 'js' || ext === 'jsx' ? 'text-yellow' :
    ext === 'py' ? 'text-green' :
    ext === 'rs' ? 'text-peach' :
    ext === 'md' ? 'text-subtext1' :
    ext === 'json' ? 'text-yellow' :
    ext === 'css' || ext === 'scss' ? 'text-mauve' :
    ext === 'html' ? 'text-peach' :
    'text-overlay1'

  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className={`flex-shrink-0 ${color}`}>
      <path d="M9 1H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6L9 1zM9 1v5h5" />
    </svg>
  )
}

// ─── Inline Name Input ────────────────────────────────────────────────────────

function InlineInput({
  placeholder,
  defaultValue,
  onCommit,
  onCancel,
}: {
  placeholder: string
  defaultValue?: string
  onCommit: (name: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(defaultValue ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const committed = useRef(false)

  useEffect(() => {
    // Small delay so the input isn't immediately blurred
    const t = setTimeout(() => {
      inputRef.current?.focus()
      if (defaultValue) inputRef.current?.select()
    }, 50)
    return () => clearTimeout(t)
  }, [defaultValue])

  const commit = () => {
    if (committed.current) return
    committed.current = true
    const trimmed = value.trim()
    if (trimmed && trimmed !== (defaultValue ?? '')) {
      onCommit(trimmed)
    } else {
      onCancel()
    }
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        // Small delay to let Enter keydown fire first
        setTimeout(commit, 100)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit() }
        if (e.key === 'Escape') { committed.current = true; onCancel() }
        e.stopPropagation()
      }}
      onClick={(e) => e.stopPropagation()}
      placeholder={placeholder}
      className="mx-2 my-0.5 w-[calc(100%-1rem)] bg-surface0 border border-blue rounded px-2 py-0.5 text-xs text-text placeholder-overlay1 outline-none"
    />
  )
}

// ─── Tree Node ────────────────────────────────────────────────────────────────

function TreeNode({
  entry,
  depth,
  onFileClick,
  onContextMenu,
  creatingIn,
  onDrop,
  renamingPath,
  onRenameCommit,
  onRenameCancel,
}: {
  entry: DirEntry
  depth: number
  onFileClick: (entry: DirEntry) => void
  onContextMenu: (e: React.MouseEvent, entry: DirEntry) => void
  creatingIn: string | null
  onDrop: (srcPath: string, destDir: string) => void
  renamingPath: string | null
  onRenameCommit: (oldPath: string, newName: string) => void
  onRenameCancel: () => void
}) {
  const [expanded, setExpanded] = useState(depth === 0)
  const [children, setChildren] = useState<DirEntry[]>(entry.children ?? [])
  const [loaded, setLoaded] = useState(!!entry.children)
  const [dragOver, setDragOver] = useState(false)

  // Auto-expand if creating a file inside this dir
  useEffect(() => {
    if (creatingIn === entry.path && entry.isDirectory && !expanded) {
      handleToggle()
    }
  }, [creatingIn]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = async () => {
    if (!entry.isDirectory) return
    if (!loaded) {
      try {
        const entries = await window.nexusAPI.fs.readDir(entry.path)
        setChildren(entries)
        setLoaded(true)
      } catch { /* ignore */ }
    }
    setExpanded((v) => !v)
  }

  // Refresh children
  const refreshChildren = async () => {
    if (!entry.isDirectory) return
    try {
      const entries = await window.nexusAPI.fs.readDir(entry.path)
      setChildren(entries)
      setLoaded(true)
    } catch { /* ignore */ }
  }

  // Re-load children when creatingIn changes (a file was just created here)
  useEffect(() => {
    if (loaded && entry.isDirectory) {
      refreshChildren()
    }
  }, [creatingIn]) // eslint-disable-line react-hooks/exhaustive-deps

  const isRenaming = renamingPath === entry.path

  // ── Drag & Drop ──────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', entry.path)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (!entry.isDirectory) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleDropHere = (e: React.DragEvent) => {
    setDragOver(false)
    if (!entry.isDirectory) return
    e.preventDefault()
    const srcPath = e.dataTransfer.getData('text/plain')
    if (srcPath && srcPath !== entry.path) {
      onDrop(srcPath, entry.path)
    }
  }

  return (
    <div>
      {/* Row */}
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDropHere}
        className={`flex items-center gap-1.5 px-2 py-0.5 cursor-pointer rounded mx-1 text-sm transition-colors ${
          dragOver ? 'bg-blue/20 ring-1 ring-blue/40' :
          entry.isDirectory ? 'text-text hover:bg-surface0' : 'text-subtext1 hover:text-text hover:bg-surface0'
        }`}
        style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
        onClick={entry.isDirectory ? handleToggle : () => onFileClick(entry)}
        onContextMenu={(e) => onContextMenu(e, entry)}
      >
        {entry.isDirectory && (
          <svg
            width="10" height="10"
            viewBox="0 0 10 10"
            fill="currentColor"
            className={`flex-shrink-0 text-overlay0 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
          >
            <path d="M3 2l4 3-4 3V2z" />
          </svg>
        )}
        {!entry.isDirectory && <span className="w-2.5" />}
        {entry.isDirectory ? <FolderIcon open={expanded} /> : <FileIcon name={entry.name} />}

        {isRenaming ? (
          <InlineInput
            placeholder={entry.name}
            defaultValue={entry.name}
            onCommit={(newName) => onRenameCommit(entry.path, newName)}
            onCancel={onRenameCancel}
          />
        ) : (
          <span className="truncate text-xs">{entry.name}</span>
        )}
      </div>

      {/* Children */}
      {entry.isDirectory && expanded && (
        <div>
          {/* Inline new file input */}
          {creatingIn === entry.path && (
            <div style={{ paddingLeft: `${0.5 + (depth + 1) * 0.75}rem` }}>
              <InlineInput
                placeholder="filename..."
                onCommit={(name) => {
                  // This triggers via the FileTree's commitNewFile
                  const ev = new CustomEvent('nexus:commitNewFile', { detail: name })
                  window.dispatchEvent(ev)
                }}
                onCancel={() => {
                  window.dispatchEvent(new CustomEvent('nexus:cancelNewFile'))
                }}
              />
            </div>
          )}
          {children.map((child) => (
            <TreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              onFileClick={onFileClick}
              onContextMenu={onContextMenu}
              creatingIn={creatingIn}
              onDrop={onDrop}
              renamingPath={renamingPath}
              onRenameCommit={onRenameCommit}
              onRenameCancel={onRenameCancel}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

interface CtxMenu {
  x: number
  y: number
  entry: DirEntry
}

function CtxItem({
  label,
  onClick,
  danger = false,
}: {
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 hover:bg-surface1 transition-colors ${danger ? 'text-red hover:text-red' : 'text-subtext1 hover:text-text'}`}
    >
      {label}
    </button>
  )
}

// ─── File Tree ────────────────────────────────────────────────────────────────

export default function FileTree() {
  const { projectPath, setProjectPath } = useAppStore()
  const { openTab } = useEditorStore()
  const [rootEntries, setRootEntries] = useState<DirEntry[]>([])
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const [creatingIn, setCreatingIn] = useState<string | null>(null)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)

  // ── Load / reload the file tree ──────────────────────────────────────────
  const loadTree = useCallback(async (dirPath: string) => {
    try {
      const entries = await window.nexusAPI.fs.readDir(dirPath)
      setRootEntries(entries)
    } catch (err) {
      console.error('Failed to read directory:', dirPath, err)
    }
  }, [])

  // Auto-load tree when projectPath changes (including on remount after sidebar toggle)
  useEffect(() => {
    if (projectPath) loadTree(projectPath)
  }, [projectPath, loadTree])

  const openFolder = useCallback(async () => {
    const path = await window.nexusAPI.fs.openFolder()
    if (!path) return
    setProjectPath(path)
    // loadTree will auto-fire via the useEffect above
  }, [setProjectPath])

  const refreshRoot = useCallback(() => {
    if (projectPath) loadTree(projectPath)
  }, [projectPath, loadTree])

  const handleFileClick = useCallback(
    async (entry: DirEntry) => {
      if (entry.isDirectory) return
      try {
        const content = await window.nexusAPI.fs.readFile(entry.path)
        openTab(entry.path, entry.name, content)
      } catch (err) {
        console.error('Failed to read file:', entry.path, err)
      }
    },
    [openTab],
  )

  const handleContextMenu = (e: React.MouseEvent, entry: DirEntry) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, entry })
  }

  // ── New file ─────────────────────────────────────────────────────────────
  const startNewFile = (dirPath: string) => {
    setCtxMenu(null)
    setCreatingIn(dirPath)
  }

  // Listen for custom events from InlineInput inside TreeNode
  useEffect(() => {
    const handleCommit = async (e: Event) => {
      const name = (e as CustomEvent).detail as string
      if (!creatingIn) return
      const dir = creatingIn === '__root__' ? projectPath : creatingIn
      if (!dir) { setCreatingIn(null); return }
      const sep = dir.includes('/') ? '/' : '\\'
      const filePath = dir + sep + name
      try {
        await window.nexusAPI.fs.createFile(filePath)
        await refreshRoot()
        openTab(filePath, name, '')
      } catch (err) {
        console.error('Failed to create file:', err)
      }
      setCreatingIn(null)
    }

    const handleCancel = () => setCreatingIn(null)

    window.addEventListener('nexus:commitNewFile', handleCommit)
    window.addEventListener('nexus:cancelNewFile', handleCancel)
    return () => {
      window.removeEventListener('nexus:commitNewFile', handleCommit)
      window.removeEventListener('nexus:cancelNewFile', handleCancel)
    }
  }, [creatingIn, projectPath, refreshRoot, openTab])

  // ── New folder ───────────────────────────────────────────────────────────
  const [creatingFolderIn, setCreatingFolderIn] = useState<string | null>(null)
  const startNewFolder = (dirPath: string) => {
    setCtxMenu(null)
    setCreatingFolderIn(dirPath)
  }

  // ── Rename ───────────────────────────────────────────────────────────────
  const startRename = () => {
    if (!ctxMenu) return
    setRenamingPath(ctxMenu.entry.path)
    setCtxMenu(null)
  }

  const handleRenameCommit = async (oldPath: string, newName: string) => {
    const dir = parentDir(oldPath)
    const sep = dir.includes('/') ? '/' : '\\'
    const newPath = dir + sep + newName
    try {
      await window.nexusAPI.fs.rename(oldPath, newPath)
      await refreshRoot()
    } catch (err) {
      console.error('Failed to rename:', err)
    }
    setRenamingPath(null)
  }

  // ── Move (drag & drop) ──────────────────────────────────────────────────
  const handleDrop = async (srcPath: string, destDir: string) => {
    const srcName = srcPath.split(/[\\/]/).pop()
    if (!srcName) return
    const sep = destDir.includes('/') ? '/' : '\\'
    const destPath = destDir + sep + srcName
    if (srcPath === destPath) return
    try {
      await window.nexusAPI.fs.rename(srcPath, destPath)
      await refreshRoot()
    } catch (err) {
      console.error('Failed to move file:', err)
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  const ctxDelete = async () => {
    if (!ctxMenu) return
    const name = ctxMenu.entry.name
    setCtxMenu(null)
    try {
      await window.nexusAPI.fs.deleteEntry(ctxMenu.entry.path)
      await refreshRoot()
    } catch (err) {
      console.error('Failed to delete:', name, err)
    }
  }

  // ── Open in browser (HTML files) ─────────────────────────────────────────
  const ctxOpenInBrowser = () => {
    if (!ctxMenu) return
    const filePath = ctxMenu.entry.path
    setCtxMenu(null)
    // Use file:// protocol via Electron shell.openExternal
    const fileUrl = 'file:///' + filePath.replace(/\\/g, '/').replace(/^\//, '')
    window.nexusAPI.app.openExternal(fileUrl)
  }

  // ── Copy path ────────────────────────────────────────────────────────────
  const ctxCopyPath = () => {
    if (!ctxMenu) return
    navigator.clipboard.writeText(ctxMenu.entry.path)
    setCtxMenu(null)
  }

  // Check if context menu entry is HTML
  const isHtmlFile = ctxMenu && !ctxMenu.entry.isDirectory &&
    /\.html?$/i.test(ctxMenu.entry.name)

  // Target dir for "New File Here" / "New Folder Here"
  const ctxTargetDir = ctxMenu
    ? (ctxMenu.entry.isDirectory ? ctxMenu.entry.path : parentDir(ctxMenu.entry.path))
    : projectPath

  return (
    <div className="flex flex-col h-full text-sm">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface0 flex-shrink-0">
        <span className="text-2xs font-semibold uppercase tracking-widest text-overlay0">Explorer</span>
        <div className="flex gap-1">
          {projectPath && (
            <>
              {/* New file in root */}
              <button
                title="New File"
                onClick={() => startNewFile(projectPath)}
                className="p-1 rounded text-overlay1 hover:text-text hover:bg-surface1 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 1H3a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V6L9 1z"/>
                  <path d="M9 1v5h5"/>
                  <path d="M8 9v4M6 11h4" strokeLinecap="round"/>
                </svg>
              </button>
              {/* New folder in root */}
              <button
                title="New Folder"
                onClick={() => startNewFolder(projectPath)}
                className="p-1 rounded text-overlay1 hover:text-text hover:bg-surface1 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M1 4a1 1 0 011-1h4.586l1.707 1.707A1 1 0 009 5h5a1 1 0 011 1v6a1 1 0 01-1 1H2a1 1 0 01-1-1V4z"/>
                  <path d="M8 8v4M6 10h4" strokeLinecap="round"/>
                </svg>
              </button>
            </>
          )}
          <button
            title="Open Folder"
            onClick={openFolder}
            className="p-1 rounded text-overlay1 hover:text-text hover:bg-surface1 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1 4a1 1 0 011-1h4.586l1.707 1.707A1 1 0 009 5h5a1 1 0 011 1v6a1 1 0 01-1 1H2a1 1 0 01-1-1V4z"/>
            </svg>
          </button>
          <button
            title="Refresh"
            onClick={refreshRoot}
            className="p-1 rounded text-overlay1 hover:text-text hover:bg-surface1 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M13.5 8a5.5 5.5 0 11-1.4-3.7"/>
              <path d="M12 1v4h-4"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Tree ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-1 selectable">
        {!projectPath ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-surface2">
              <rect x="4" y="10" width="32" height="24" rx="3" stroke="currentColor" strokeWidth="2"/>
              <path d="M4 16h32" stroke="currentColor" strokeWidth="2"/>
              <path d="M4 14l8-4h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <p className="text-xs text-overlay0">No folder open</p>
            <button
              onClick={openFolder}
              className="text-xs text-blue hover:text-lavender underline underline-offset-2"
            >
              Open Folder
            </button>
          </div>
        ) : (
          <>
            {/* Root-level inline inputs */}
            {creatingIn === projectPath && (
              <div className="px-1">
                <InlineInput
                  placeholder="filename..."
                  onCommit={async (name) => {
                    const sep = projectPath.includes('/') ? '/' : '\\'
                    const filePath = projectPath + sep + name
                    try {
                      await window.nexusAPI.fs.createFile(filePath)
                      await refreshRoot()
                      openTab(filePath, name, '')
                    } catch (err) {
                      console.error('Create failed:', err)
                    }
                    setCreatingIn(null)
                  }}
                  onCancel={() => setCreatingIn(null)}
                />
              </div>
            )}
            {creatingFolderIn === projectPath && (
              <div className="px-1">
                <InlineInput
                  placeholder="folder name..."
                  onCommit={async (name) => {
                    const sep = projectPath.includes('/') ? '/' : '\\'
                    const dirPath = projectPath + sep + name
                    try {
                      await window.nexusAPI.fs.createDir(dirPath)
                      await refreshRoot()
                    } catch (err) {
                      console.error('Create dir failed:', err)
                    }
                    setCreatingFolderIn(null)
                  }}
                  onCancel={() => setCreatingFolderIn(null)}
                />
              </div>
            )}
            {rootEntries.map((entry) => (
              <TreeNode
                key={entry.path}
                entry={entry}
                depth={0}
                onFileClick={handleFileClick}
                onContextMenu={handleContextMenu}
                creatingIn={creatingIn}
                onDrop={handleDrop}
                renamingPath={renamingPath}
                onRenameCommit={handleRenameCommit}
                onRenameCancel={() => setRenamingPath(null)}
              />
            ))}
          </>
        )}
      </div>

      {/* ── Context Menu ───────────────────────────────────────────────────── */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setCtxMenu(null)} />
          <div
            className="fixed z-50 w-48 bg-mantle border border-surface0 rounded-lg shadow-2xl py-1 text-xs fade-in"
            style={{
              left: Math.min(ctxMenu.x, window.innerWidth - 200),
              top: Math.min(ctxMenu.y, window.innerHeight - 260),
            }}
          >
            <CtxItem label="New File"   onClick={() => startNewFile(ctxTargetDir!)} />
            <CtxItem label="New Folder" onClick={() => startNewFolder(ctxTargetDir!)} />
            <div className="my-1 border-t border-surface0" />
            <CtxItem label="Rename"     onClick={startRename} />
            <CtxItem label="Copy Path"  onClick={ctxCopyPath} />
            <div className="my-1 border-t border-surface0" />
            <CtxItem
              label="Show in File Explorer"
              onClick={() => {
                window.nexusAPI.app.showItemInFolder(ctxMenu.entry.path)
                setCtxMenu(null)
              }}
            />
            {isHtmlFile && (
              <>
                <div className="my-1 border-t border-surface0" />
                <CtxItem label="Open in Browser" onClick={ctxOpenInBrowser} />
              </>
            )}
            <div className="my-1 border-t border-surface0" />
            <CtxItem label="Delete" danger onClick={ctxDelete} />
          </div>
        </>
      )}
    </div>
  )
}

