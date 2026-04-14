import { useState, useRef, useEffect } from 'react'
import { useEditorStore } from '../../store'
import type { EditorTab } from '../../types'

// ─── Tab Button ───────────────────────────────────────────────────────────────

function Tab({ tab, isActive }: { tab: EditorTab; isActive: boolean }) {
  const { setActiveTab, closeTab, renameTab } = useEditorStore()
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(tab.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setEditValue(tab.name)
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing, tab.name])

  const commitRename = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== tab.name) {
      renameTab(tab.id, trimmed)
    }
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitRename()
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <div
      role="tab"
      aria-selected={isActive}
      onClick={() => !editing && setActiveTab(tab.id)}
      className={`group flex items-center gap-1.5 px-3 py-1.5 border-r border-surface0 cursor-pointer flex-shrink-0 text-xs transition-colors select-none max-w-44 ${
        isActive
          ? 'bg-base text-text border-t-2 border-t-blue'
          : 'bg-mantle text-subtext0 hover:bg-surface1 hover:text-text'
      }`}
    >
      {/* Dirty indicator */}
      {tab.isDirty && !editing && (
        <span className="w-1.5 h-1.5 rounded-full bg-peach flex-shrink-0" />
      )}

      {/* Name — inline editable on double-click */}
      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="bg-surface0 text-text border border-blue rounded px-1 py-0 text-xs w-28 outline-none"
          style={{ minWidth: 60, maxWidth: 120 }}
        />
      ) : (
        <span
          className="truncate"
          onDoubleClick={(e) => {
            e.stopPropagation()
            setEditing(true)
          }}
        >
          {tab.name}
        </span>
      )}

      {/* Close button */}
      {!editing && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            closeTab(tab.id)
          }}
          className={`ml-auto flex-shrink-0 rounded p-0.5 transition-colors ${
            isActive
              ? 'text-overlay1 hover:text-text hover:bg-surface1'
              : 'opacity-0 group-hover:opacity-100 text-overlay1 hover:text-text hover:bg-surface1'
          }`}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

export default function TabBar() {
  const { tabs, activeTabId } = useEditorStore()

  if (tabs.length === 0) return null

  return (
    <div className="flex items-end h-9 border-b border-surface0 bg-mantle overflow-x-auto tab-bar-scroll flex-shrink-0">
      {tabs.map((tab) => (
        <Tab key={tab.id} tab={tab} isActive={tab.id === activeTabId} />
      ))}
    </div>
  )
}
