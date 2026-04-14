import { useState, useEffect, useCallback } from 'react'
import { useAppStore, useEditorStore } from '../../store'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GitFile {
  status: string
  path: string
}

interface GitLogEntry {
  hash: string
  author: string
  email: string
  timestamp: number
  message: string
}

// ─── Status badge color ───────────────────────────────────────────────────────

function statusColor(s: string): string {
  if (s.includes('M')) return 'text-yellow'
  if (s.includes('A') || s === '??') return 'text-green'
  if (s.includes('D')) return 'text-red'
  if (s.includes('R')) return 'text-blue'
  if (s.includes('U')) return 'text-peach'
  return 'text-subtext0'
}

function statusLabel(s: string): string {
  if (s === '??') return 'U'
  if (s === 'M' || s === ' M') return 'M'
  if (s === 'A' || s === 'AM') return 'A'
  if (s === 'D' || s === ' D') return 'D'
  if (s === 'R') return 'R'
  return s.trim() || '?'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GitPanel() {
  const projectPath = useAppStore((s) => s.projectPath)
  const [branch, setBranch] = useState('')
  const [files, setFiles] = useState<GitFile[]>([])
  const [commitMsg, setCommitMsg] = useState('')
  const [log, setLog] = useState<GitLogEntry[]>([])
  const [tab, setTab] = useState<'changes' | 'log'>('changes')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refresh git status
  const refresh = useCallback(async () => {
    if (!projectPath) return
    setLoading(true)
    try {
      const result = await window.nexusAPI.git.status(projectPath)
      if (result.error) {
        setError(result.error)
        setBranch('')
        setFiles([])
      } else {
        setError(null)
        setBranch(result.branch)
        setFiles(result.files)
      }
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }, [projectPath])

  // Load git log
  const loadLog = useCallback(async () => {
    if (!projectPath) return
    try {
      const entries = await window.nexusAPI.git.log(projectPath, 50)
      setLog(entries)
    } catch {
      setLog([])
    }
  }, [projectPath])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (tab === 'log') loadLog()
  }, [tab, loadLog])

  // Actions
  const stageAll = async () => {
    if (!projectPath) return
    await window.nexusAPI.git.stage(projectPath, ['.'])
    refresh()
  }

  const unstageAll = async () => {
    if (!projectPath) return
    await window.nexusAPI.git.unstage(projectPath, ['.'])
    refresh()
  }

  const stageFile = async (filePath: string) => {
    if (!projectPath) return
    await window.nexusAPI.git.stage(projectPath, [filePath])
    refresh()
  }

  const discardFile = async (filePath: string) => {
    if (!projectPath) return
    await window.nexusAPI.git.discard(projectPath, filePath)
    refresh()
  }

  const commit = async () => {
    if (!projectPath || !commitMsg.trim()) return
    setLoading(true)
    const result = await window.nexusAPI.git.commit(projectPath, commitMsg.trim())
    if (result.success) {
      setCommitMsg('')
      refresh()
    } else {
      setError(result.error ?? 'Commit failed')
    }
    setLoading(false)
  }

  const push = async () => {
    if (!projectPath) return
    setLoading(true)
    const result = await window.nexusAPI.git.push(projectPath)
    if (!result.success) setError(result.error ?? 'Push failed')
    setLoading(false)
  }

  const pull = async () => {
    if (!projectPath) return
    setLoading(true)
    const result = await window.nexusAPI.git.pull(projectPath)
    if (result.success) refresh()
    else setError(result.error ?? 'Pull failed')
    setLoading(false)
  }

  const openDiff = async (gitFile: GitFile) => {
    if (!projectPath) return
    const fullPath = projectPath + '/' + gitFile.path
    try {
      const content = await window.nexusAPI.fs.readFile(fullPath)
      const name = gitFile.path.split(/[\\/]/).pop() ?? gitFile.path
      useEditorStore.getState().openTab(fullPath, name, content)
    } catch { /* ignore */ }
  }

  if (!projectPath) {
    return (
      <div className="flex-1 flex items-center justify-center text-overlay0 text-xs p-4 text-center">
        Open a project folder to use Git features
      </div>
    )
  }

  // Separate staged vs unstaged
  const staged = files.filter((f) => {
    const idx = f.status[0]
    return idx !== ' ' && idx !== '?' && f.status !== '??'
  })
  const unstaged = files.filter((f) => {
    const idx = f.status[1]
    return idx === 'M' || idx === 'D' || f.status === '??'
  })

  return (
    <div className="flex flex-col h-full text-xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface0">
        <div className="flex items-center gap-2">
          <span className="text-subtext1 font-medium uppercase tracking-wider text-2xs">Source Control</span>
          {branch && (
            <span className="text-blue flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zm0 9.5a.75.75 0 111.5 0 .75.75 0 01-1.5 0z"/>
                <path d="M5.75 4v4.5a.75.75 0 001.5 0V4h-1.5zM5.75 9.5v2.5h1.5V9.5h-1.5z"/>
              </svg>
              {branch}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={pull} title="Pull" className="p-1 hover:bg-surface1 rounded transition-colors text-subtext0 hover:text-text">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 2v10M5 9l3 3 3-3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 14h10" strokeLinecap="round"/>
            </svg>
          </button>
          <button onClick={push} title="Push" className="p-1 hover:bg-surface1 rounded transition-colors text-subtext0 hover:text-text">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 12V2M5 5l3-3 3 3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 14h10" strokeLinecap="round"/>
            </svg>
          </button>
          <button onClick={refresh} title="Refresh" className="p-1 hover:bg-surface1 rounded transition-colors text-subtext0 hover:text-text">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 8a6 6 0 0110.89-3.48M14 8a6 6 0 01-10.89 3.48" strokeLinecap="round"/>
              <path d="M14 2v4h-4M2 14v-4h4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-1.5 bg-red/10 text-red text-2xs border-b border-surface0">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-surface0">
        <button
          onClick={() => setTab('changes')}
          className={`flex-1 py-1.5 text-center transition-colors ${
            tab === 'changes' ? 'text-text border-b-2 border-blue' : 'text-subtext0 hover:text-text'
          }`}
        >
          Changes {files.length > 0 && <span className="ml-1 bg-surface1 px-1.5 rounded-full">{files.length}</span>}
        </button>
        <button
          onClick={() => setTab('log')}
          className={`flex-1 py-1.5 text-center transition-colors ${
            tab === 'log' ? 'text-text border-b-2 border-blue' : 'text-subtext0 hover:text-text'
          }`}
        >
          History
        </button>
      </div>

      {tab === 'changes' ? (
        <div className="flex-1 overflow-auto">
          {/* Commit input */}
          <div className="p-2 border-b border-surface0">
            <div className="flex gap-1">
              <input
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commit() }}
                placeholder="Commit message (Ctrl+Enter)"
                className="flex-1 bg-surface0 text-text px-2 py-1.5 rounded text-xs outline-none focus:ring-1 focus:ring-blue placeholder:text-overlay0"
              />
              <button
                onClick={commit}
                disabled={!commitMsg.trim() || loading}
                className="px-3 py-1.5 bg-blue text-crust rounded font-medium hover:bg-blue/80 disabled:opacity-30 transition-colors"
              >
                ✓
              </button>
            </div>
          </div>

          {/* Staged Changes */}
          {staged.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-3 py-1 bg-surface0/30">
                <span className="text-subtext0 uppercase tracking-wider text-2xs font-medium">
                  Staged ({staged.length})
                </span>
                <button onClick={unstageAll} title="Unstage All" className="text-2xs text-subtext0 hover:text-text">
                  −
                </button>
              </div>
              {staged.map((f) => (
                <FileRow key={`s-${f.path}`} file={f} onOpen={openDiff} onAction={() => {
                  if (projectPath) window.nexusAPI.git.unstage(projectPath, [f.path]).then(refresh)
                }} actionIcon="−" actionTitle="Unstage" />
              ))}
            </div>
          )}

          {/* Unstaged / Untracked Changes */}
          {unstaged.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-3 py-1 bg-surface0/30">
                <span className="text-subtext0 uppercase tracking-wider text-2xs font-medium">
                  Changes ({unstaged.length})
                </span>
                <button onClick={stageAll} title="Stage All" className="text-2xs text-subtext0 hover:text-text">
                  +
                </button>
              </div>
              {unstaged.map((f) => (
                <FileRow key={`u-${f.path}`} file={f} onOpen={openDiff} onAction={() => stageFile(f.path)} actionIcon="+" actionTitle="Stage"
                  onDiscard={() => discardFile(f.path)}
                />
              ))}
            </div>
          )}

          {files.length === 0 && !loading && (
            <div className="flex items-center justify-center py-8 text-overlay0 text-xs">
              No changes
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-4 text-overlay0 text-xs">
              Loading…
            </div>
          )}
        </div>
      ) : (
        /* Log tab */
        <div className="flex-1 overflow-auto">
          {log.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-overlay0 text-xs">
              {loading ? 'Loading…' : 'No commits yet'}
            </div>
          ) : (
            log.map((entry) => (
              <div
                key={entry.hash}
                className="px-3 py-2 border-b border-surface0/50 hover:bg-surface0/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-text truncate flex-1">{entry.message}</span>
                  <span className="text-overlay0 text-2xs flex-shrink-0 font-mono">{entry.hash.slice(0, 7)}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-2xs text-subtext0">
                  <span>{entry.author}</span>
                  <span>•</span>
                  <span>{formatRelative(entry.timestamp)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── File Row ─────────────────────────────────────────────────────────────────

function FileRow({
  file,
  onOpen,
  onAction,
  actionIcon,
  actionTitle,
  onDiscard,
}: {
  file: GitFile
  onOpen: (f: GitFile) => void
  onAction: () => void
  actionIcon: string
  actionTitle: string
  onDiscard?: () => void
}) {
  const fileName = file.path.split(/[\\/]/).pop() ?? file.path
  const dirPath = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : ''

  return (
    <div
      className="group flex items-center gap-1 px-3 py-1 hover:bg-surface0/30 transition-colors cursor-pointer"
      onClick={() => onOpen(file)}
    >
      <span className={`w-4 text-center font-mono text-2xs ${statusColor(file.status)}`}>
        {statusLabel(file.status)}
      </span>
      <span className="flex-1 truncate text-text">
        {fileName}
        {dirPath && <span className="text-overlay0 ml-1">{dirPath}</span>}
      </span>
      <div className="hidden group-hover:flex items-center gap-0.5">
        {onDiscard && (
          <button
            onClick={(e) => { e.stopPropagation(); onDiscard() }}
            title="Discard Changes"
            className="w-5 h-5 flex items-center justify-center text-red hover:bg-surface1 rounded"
          >
            ↩
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onAction() }}
          title={actionTitle}
          className="w-5 h-5 flex items-center justify-center text-subtext0 hover:bg-surface1 rounded"
        >
          {actionIcon}
        </button>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(timestamp: number): string {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}
