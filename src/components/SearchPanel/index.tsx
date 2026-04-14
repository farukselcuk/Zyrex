import { useState, useCallback, useRef } from 'react'
import { useAppStore, useEditorStore } from '../../store'

interface SearchResult {
  file: string
  line: number
  text: string
}

export default function SearchPanel() {
  const { projectPath } = useAppStore()
  const { openTab } = useEditorStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const doSearch = useCallback(async () => {
    if (!query.trim() || !projectPath) return
    setSearching(true)
    try {
      const hits = await window.nexusAPI.search.inFiles(projectPath, query.trim())
      setResults(hits)
    } catch {
      setResults([])
    }
    setSearching(false)
  }, [query, projectPath])

  const openResult = async (r: SearchResult) => {
    try {
      const content = await window.nexusAPI.fs.readFile(r.file)
      const name = r.file.split(/[\\/]/).pop() ?? r.file
      openTab(r.file, name, content)
    } catch (err) {
      console.error('Failed to open:', err)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') doSearch()
  }

  return (
    <div className="flex flex-col h-full text-sm">
      {/* Header */}
      <div className="px-3 py-2 border-b border-surface0 flex-shrink-0">
        <span className="text-2xs font-semibold uppercase tracking-widest text-overlay0">Search</span>
      </div>

      {/* Search Input */}
      <div className="px-2 py-2 flex-shrink-0">
        <div className="flex items-center gap-1.5 bg-surface0 rounded-lg px-2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-overlay0 flex-shrink-0">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search in files..."
            className="flex-1 bg-transparent py-1.5 text-xs text-text placeholder-overlay1 outline-none"
          />
          {searching && (
            <div className="w-3 h-3 border border-blue border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-1">
        {!projectPath && (
          <p className="text-xs text-overlay0 px-2 py-4 text-center">Open a folder first</p>
        )}
        {results.length === 0 && query && !searching && (
          <p className="text-xs text-overlay0 px-2 py-4 text-center">No results</p>
        )}
        {results.map((r, i) => {
          const relPath = projectPath
            ? r.file.replace(projectPath, '').replace(/^[\\/]/, '')
            : r.file
          return (
            <button
              key={`${r.file}:${r.line}:${i}`}
              onClick={() => openResult(r)}
              className="w-full text-left px-2 py-1 rounded hover:bg-surface0 transition-colors group"
            >
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-blue truncate">{relPath}</span>
                <span className="text-overlay0 flex-shrink-0">:{r.line}</span>
              </div>
              <div className="text-2xs text-subtext0 truncate mt-0.5 pl-2">
                {r.text}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
