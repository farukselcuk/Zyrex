import { useState, useCallback, useEffect, useRef } from 'react'
import TabBar from './TabBar'
import Breadcrumb from './Breadcrumb'
import MonacoWrapper from './MonacoWrapper'
import { editorRefStore } from '../../store/editorRef'

// ─── Context Menu ─────────────────────────────────────────────────────────────

interface MenuState {
  x: number
  y: number
}

const MENU_ITEMS = [
  { label: 'Copy',            action: 'copy',   shortcut: 'Ctrl+C' },
  { label: 'Cut',             action: 'cut',    shortcut: 'Ctrl+X' },
  { label: 'Paste',           action: 'paste',  shortcut: 'Ctrl+V' },
  null, // separator
  { label: 'Select All',      action: 'selectAll', shortcut: 'Ctrl+A' },
  null,
  { label: 'Format Document', action: 'format', shortcut: 'Ctrl+Shift+F' },
] as const

function ContextMenu({ x, y, onAction, onClose }: {
  x: number
  y: number
  onAction: (action: string) => void
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Adjust position so menu doesn't overflow the viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(y, window.innerHeight - 220),
    left: Math.min(x, window.innerWidth - 200),
    zIndex: 9999,
  }

  return (
    <div
      ref={menuRef}
      style={style}
      className="bg-mantle border border-surface1 rounded shadow-2xl py-1 w-52 text-xs select-none fade-in"
    >
      {MENU_ITEMS.map((item, i) =>
        item === null ? (
          <div key={`sep-${i}`} className="border-t border-surface0 my-1" />
        ) : (
          <button
            key={item.action}
            onMouseDown={(e) => {
              e.preventDefault()
              onAction(item.action)
            }}
            className="flex w-full items-center justify-between px-3 py-1.5 text-subtext1 hover:bg-surface1 hover:text-text transition-colors"
          >
            <span>{item.label}</span>
            <span className="text-overlay0 text-2xs">{item.shortcut}</span>
          </button>
        ),
      )}
    </div>
  )
}

// ─── Editor Area ──────────────────────────────────────────────────────────────

export default function EditorArea() {
  const [menu, setMenu] = useState<MenuState | null>(null)

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    // Only show for clicks on the Monaco editor canvas, not on TabBar
    const target = e.target as HTMLElement
    if (target.closest('[data-tab-bar]')) return
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }, [])

  const handleAction = useCallback((action: string) => {
    setMenu(null)
    const editor = editorRefStore.get()
    if (!editor) return

    switch (action) {
      case 'copy':
        editor.focus()
        editor.getAction('editor.action.clipboardCopyAction')?.run()
        break
      case 'cut':
        editor.focus()
        editor.getAction('editor.action.clipboardCutAction')?.run()
        break
      case 'paste':
        editor.focus()
        editor.trigger('contextMenu', 'editor.action.clipboardPasteAction', null)
        break
      case 'selectAll':
        editor.focus()
        editor.getAction('editor.action.selectAll')?.run()
        break
      case 'format':
        editor.getAction('editor.action.formatDocument')?.run()
        break
    }
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden" onContextMenu={handleContextMenu}>
      <div data-tab-bar="">
        <TabBar />
      </div>
      <Breadcrumb />
      <MonacoWrapper />
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onAction={handleAction}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}
