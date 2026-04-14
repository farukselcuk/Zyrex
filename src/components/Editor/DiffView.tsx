import { useRef, useEffect } from 'react'
import * as monaco from 'monaco-editor'

interface DiffViewProps {
  original: string
  modified: string
  language?: string
  originalLabel?: string
  modifiedLabel?: string
  onAccept?: (content: string) => void
  onReject?: () => void
}

/**
 * Monaco Diff Editor — shows side-by-side changes with Accept/Reject controls.
 * Used to display AI-generated code changes before applying them.
 */
export default function DiffView({
  original,
  modified,
  language = 'typescript',
  originalLabel = 'Original',
  modifiedLabel = 'Modified',
  onAccept,
  onReject,
}: DiffViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const editor = monaco.editor.createDiffEditor(containerRef.current, {
      theme: 'nexus-dark',
      readOnly: true,
      renderSideBySide: true,
      automaticLayout: true,
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", monospace',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      lineNumbers: 'on',
      glyphMargin: false,
      folding: true,
      renderIndicators: true,
      originalEditable: false,
    })

    const originalModel = monaco.editor.createModel(original, language)
    const modifiedModel = monaco.editor.createModel(modified, language)

    editor.setModel({
      original: originalModel,
      modified: modifiedModel,
    })

    editorRef.current = editor

    return () => {
      originalModel.dispose()
      modifiedModel.dispose()
      editor.dispose()
      editorRef.current = null
    }
  }, [original, modified, language])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-mantle border-b border-surface0 flex-shrink-0">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-red">{originalLabel}</span>
          <span className="text-overlay0">→</span>
          <span className="text-green">{modifiedLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {onAccept && (
            <button
              onClick={() => onAccept(modified)}
              className="px-3 py-1 bg-green/20 text-green rounded text-xs hover:bg-green/30 transition-colors"
            >
              ✓ Accept Changes
            </button>
          )}
          {onReject && (
            <button
              onClick={onReject}
              className="px-3 py-1 bg-red/20 text-red rounded text-xs hover:bg-red/30 transition-colors"
            >
              ✕ Reject
            </button>
          )}
        </div>
      </div>

      {/* Diff Editor */}
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  )
}
