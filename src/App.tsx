import { useCallback, useEffect, useState } from 'react'
import { useAppStore, useEditorStore } from './store'
import TitleBar from './components/TitleBar'
import FileTree from './components/FileTree'
import SearchPanel from './components/SearchPanel'
import EditorArea from './components/Editor/EditorArea'
import TerminalPanel from './components/Terminal'
import AIPanel from './components/AIPanel'
import StatusBar from './components/StatusBar'

export default function App() {
  const { isAIPanelOpen, isFileTreeOpen, backendPort, setBackendPort } = useAppStore()
  const [isTerminalOpen, setTerminalOpen] = useState(false)
  const [sidePanel, setSidePanel] = useState<'files' | 'search'>('files')

  // Receive backend port from main process via IPC
  useEffect(() => {
    window.nexusAPI?.on('backend:port', (port: unknown) => {
      if (typeof port === 'number') setBackendPort(port)
    })
    window.nexusAPI?.app.getBackendPort().then(setBackendPort).catch(console.error)
  }, [setBackendPort])

  // Global keyboard shortcuts
  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey

      // Ctrl+B — toggle file tree
      if (ctrl && !e.shiftKey && e.key === 'b') {
        e.preventDefault()
        useAppStore.getState().toggleFileTree()
        setSidePanel('files')
      }

      // Ctrl+Shift+A — toggle AI panel
      if (ctrl && e.shiftKey && e.key === 'a') {
        e.preventDefault()
        useAppStore.getState().toggleAIPanel()
      }

      // Ctrl+Shift+F — toggle search panel
      if (ctrl && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        if (sidePanel === 'search' && isFileTreeOpen) {
          useAppStore.getState().toggleFileTree()
        } else {
          setSidePanel('search')
          if (!isFileTreeOpen) useAppStore.getState().toggleFileTree()
        }
      }

      // Ctrl+` — toggle terminal
      if (ctrl && e.key === '`') {
        e.preventDefault()
        setTerminalOpen((v) => !v)
      }

      // Ctrl+N — new untitled tab
      if (ctrl && !e.shiftKey && e.key === 'n') {
        e.preventDefault()
        useEditorStore.getState().openNewTab()
      }

      // Ctrl+O — open file dialog
      if (ctrl && !e.shiftKey && e.key === 'o') {
        e.preventDefault()
        const filePath = await window.nexusAPI.fs.openFile()
        if (!filePath) return
        const content = await window.nexusAPI.fs.readFile(filePath)
        const name = filePath.split(/[\\/]/).pop() ?? filePath
        useEditorStore.getState().openTab(filePath, name, content)
      }
    },
    [isFileTreeOpen, sidePanel],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-base text-text">
      {/* ── Title Bar ─────────────────────────────────────────────────────── */}
      <TitleBar />

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Activity Bar (icon strip) */}
        <div className="flex-shrink-0 w-10 bg-crust border-r border-surface0 flex flex-col items-center py-2 gap-1">
          <ActivityBarIcon
            icon="files"
            active={isFileTreeOpen && sidePanel === 'files'}
            onClick={() => {
              if (sidePanel === 'files' && isFileTreeOpen) {
                useAppStore.getState().toggleFileTree()
              } else {
                setSidePanel('files')
                if (!isFileTreeOpen) useAppStore.getState().toggleFileTree()
              }
            }}
            title="Explorer (Ctrl+B)"
          />
          <ActivityBarIcon
            icon="search"
            active={isFileTreeOpen && sidePanel === 'search'}
            onClick={() => {
              if (sidePanel === 'search' && isFileTreeOpen) {
                useAppStore.getState().toggleFileTree()
              } else {
                setSidePanel('search')
                if (!isFileTreeOpen) useAppStore.getState().toggleFileTree()
              }
            }}
            title="Search (Ctrl+Shift+F)"
          />
          <div className="flex-1" />
          <ActivityBarIcon
            icon="terminal"
            active={isTerminalOpen}
            onClick={() => setTerminalOpen((v) => !v)}
            title="Terminal (Ctrl+`)"
          />
          <ActivityBarIcon
            icon="ai"
            active={isAIPanelOpen}
            onClick={() => useAppStore.getState().toggleAIPanel()}
            title="AI Panel (Ctrl+Shift+A)"
          />
        </div>

        {/* Side Panel: File Tree or Search */}
        <aside
          className={`flex-shrink-0 w-60 bg-mantle border-r border-surface0 flex flex-col overflow-hidden ${
            isFileTreeOpen ? '' : 'hidden'
          }`}
        >
          {sidePanel === 'files' ? <FileTree /> : <SearchPanel />}
        </aside>

        {/* Center + Bottom Layout */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Center: Editor Area */}
          <main className={`flex-1 flex flex-col overflow-hidden bg-base min-w-0 ${isTerminalOpen ? '' : ''}`}>
            <EditorArea />
          </main>

          {/* Bottom: Terminal Panel */}
          {isTerminalOpen && (
            <div className="flex-shrink-0 border-t border-surface0" style={{ height: '35%', minHeight: 120 }}>
              <TerminalPanel />
            </div>
          )}
        </div>

        {/* Right: AI Panel */}
        {isAIPanelOpen && (
          <aside className="flex-shrink-0 w-80 lg:w-96 bg-mantle border-l border-surface0 flex flex-col overflow-hidden">
            <AIPanel backendPort={backendPort} />
          </aside>
        )}
      </div>

      {/* ── Status Bar ────────────────────────────────────────────────────── */}
      <StatusBar />
    </div>
  )
}

// ─── Activity Bar Icon ────────────────────────────────────────────────────────

function ActivityBarIcon({
  icon,
  active,
  onClick,
  title,
}: {
  icon: 'files' | 'search' | 'terminal' | 'ai'
  active: boolean
  onClick: () => void
  title: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
        active ? 'text-text bg-surface0' : 'text-overlay0 hover:text-text hover:bg-surface0/50'
      }`}
    >
      {icon === 'files' && (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1 4a1 1 0 011-1h4.586l1.707 1.707A1 1 0 009 5h5a1 1 0 011 1v6a1 1 0 01-1 1H2a1 1 0 01-1-1V4z"/>
        </svg>
      )}
      {icon === 'search' && (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" strokeLinecap="round" />
        </svg>
      )}
      {icon === 'terminal' && (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 12l4-4-4-4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 12h4" strokeLinecap="round" />
        </svg>
      )}
      {icon === 'ai' && (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5a2 2 0 110 4 2 2 0 010-4zM5 9.5c0-1 1.34-1.5 3-1.5s3 .5 3 1.5v.5a.5.5 0 01-.5.5h-5a.5.5 0 01-.5-.5v-.5z"/>
        </svg>
      )}
    </button>
  )
}
