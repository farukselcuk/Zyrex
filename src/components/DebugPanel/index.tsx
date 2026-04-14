import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore, useEditorStore } from '../../store'
import { editorRefStore } from '../../store/editorRef'
import * as monacoNS from 'monaco-editor'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Breakpoint {
  file: string
  line: number
}

interface DebugVariable {
  name: string
  value: string
  type: string
}

interface CallStackFrame {
  name: string
  file: string
  line: number
  column: number
}

type DebugState = 'idle' | 'running' | 'paused' | 'stopped'

// ─── Breakpoint Decorations ───────────────────────────────────────────────────

const breakpointDecorations = new Map<string, string[]>() // tabId -> decorationIds

function updateBreakpointDecorations(
  editor: monacoNS.editor.IStandaloneCodeEditor | null,
  breakpoints: Breakpoint[],
  currentFile: string | undefined,
) {
  if (!editor || !currentFile) return
  const model = editor.getModel()
  if (!model) return

  const fileBreakpoints = breakpoints.filter((bp) => bp.file === currentFile)
  const decorations: monacoNS.editor.IModelDeltaDecoration[] = fileBreakpoints.map((bp) => ({
    range: new monacoNS.Range(bp.line, 1, bp.line, 1),
    options: {
      isWholeLine: true,
      glyphMarginClassName: 'debug-breakpoint-glyph',
      glyphMarginHoverMessage: { value: `Breakpoint at line ${bp.line}` },
      className: 'debug-breakpoint-line',
    },
  }))

  const oldDecorations = breakpointDecorations.get(currentFile) ?? []
  const newDecorations = editor.deltaDecorations(oldDecorations, decorations)
  breakpointDecorations.set(currentFile, newDecorations)
}

// ─── Debug Panel ──────────────────────────────────────────────────────────────

export default function DebugPanel() {
  const projectPath = useAppStore((s) => s.projectPath)
  const activeTab = useEditorStore((s) => s.tabs.find((t) => t.id === s.activeTabId))

  const [debugState, setDebugState] = useState<DebugState>('idle')
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([])
  const [variables, setVariables] = useState<DebugVariable[]>([])
  const [callStack, setCallStack] = useState<CallStackFrame[]>([])
  const [output, setOutput] = useState<string[]>([])
  const [scriptPath, setScriptPath] = useState('')
  const terminalIdRef = useRef<string | null>(null)

  // Update breakpoint decorations when breakpoints change
  useEffect(() => {
    const editor = editorRefStore.get()
    updateBreakpointDecorations(editor, breakpoints, activeTab?.path)
  }, [breakpoints, activeTab?.path])

  // Register gutter click handler for toggling breakpoints
  useEffect(() => {
    const editor = editorRefStore.get()
    if (!editor) return

    const disposable = editor.onMouseDown((e) => {
      if (
        e.target.type === monacoNS.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
        e.target.type === monacoNS.editor.MouseTargetType.GUTTER_LINE_NUMBERS
      ) {
        const line = e.target.position?.lineNumber
        const file = activeTab?.path
        if (!line || !file) return

        setBreakpoints((prev) => {
          const exists = prev.find((bp) => bp.file === file && bp.line === line)
          if (exists) return prev.filter((bp) => !(bp.file === file && bp.line === line))
          return [...prev, { file, line }]
        })
      }
    })

    return () => disposable.dispose()
  }, [activeTab?.path])

  // ── Debug Actions ─────────────────────────────────────────────────────────

  const startDebug = useCallback(async () => {
    if (!projectPath) return
    const fileToRun = scriptPath || activeTab?.path
    if (!fileToRun) return

    setDebugState('running')
    setOutput([])
    setVariables([])
    setCallStack([])

    const termId = `debug-${Date.now()}`
    terminalIdRef.current = termId

    try {
      // Build breakpoint args for Node.js inspector
      const ext = fileToRun.split('.').pop()?.toLowerCase()
      let command: string

      if (ext === 'py') {
        // Python debugging with breakpoints
        const bpArgs = breakpoints
          .filter((bp) => bp.file === fileToRun)
          .map((_bp) => `-c "import pdb; pdb.set_trace()" `)
          .join('')
        command = bpArgs ? `python -m pdb "${fileToRun}"` : `python "${fileToRun}"`
      } else {
        // Node.js / TypeScript debugging
        const runner = ext === 'ts' || ext === 'tsx' ? 'npx tsx' : 'node'
        command = `${runner} --inspect-brk "${fileToRun}"`
      }

      // Spawn via terminal IPC
      await window.nexusAPI.terminal.spawn(termId, projectPath)
      await window.nexusAPI.terminal.write(termId, command + '\r')

      setOutput((prev) => [...prev, `▶ Running: ${command}`])
      setDebugState('running')
    } catch (err) {
      setOutput((prev) => [...prev, `❌ Error: ${(err as Error).message}`])
      setDebugState('stopped')
    }
  }, [projectPath, activeTab?.path, scriptPath, breakpoints])

  const stopDebug = useCallback(async () => {
    if (terminalIdRef.current) {
      await window.nexusAPI.terminal.kill(terminalIdRef.current)
      terminalIdRef.current = null
    }
    setDebugState('idle')
    setOutput((prev) => [...prev, '⏹ Debug session stopped'])
  }, [])

  const clearBreakpoints = () => {
    setBreakpoints([])
    const editor = editorRefStore.get()
    if (editor && activeTab?.path) {
      const oldDecorations = breakpointDecorations.get(activeTab.path) ?? []
      editor.deltaDecorations(oldDecorations, [])
      breakpointDecorations.delete(activeTab.path)
    }
  }

  if (!projectPath) {
    return (
      <div className="flex-1 flex items-center justify-center text-overlay0 text-xs p-4 text-center">
        Open a project folder to use Debug features
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full text-xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface0">
        <span className="text-subtext1 font-medium uppercase tracking-wider text-2xs">Debug</span>
        <div className="flex items-center gap-1">
          {debugState === 'idle' && (
            <button
              onClick={startDebug}
              title="Start Debugging (F5)"
              className="p-1 hover:bg-surface1 rounded text-green hover:text-green transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 2l10 6-10 6V2z"/>
              </svg>
            </button>
          )}
          {(debugState === 'running' || debugState === 'paused') && (
            <>
              <button
                onClick={stopDebug}
                title="Stop (Shift+F5)"
                className="p-1 hover:bg-surface1 rounded text-red hover:text-red transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="3" y="3" width="10" height="10" rx="1"/>
                </svg>
              </button>
            </>
          )}
          <button
            onClick={clearBreakpoints}
            title="Clear All Breakpoints"
            className="p-1 hover:bg-surface1 rounded text-subtext0 hover:text-text transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="5"/>
              <path d="M5 5l6 6M11 5l-6 6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Script path input */}
      <div className="px-3 py-2 border-b border-surface0">
        <input
          value={scriptPath}
          onChange={(e) => setScriptPath(e.target.value)}
          placeholder={activeTab?.path ? `Active: ${activeTab.name}` : 'Script path to debug...'}
          className="w-full bg-surface0 text-text px-2 py-1.5 rounded text-xs outline-none focus:ring-1 focus:ring-blue placeholder:text-overlay0"
        />
      </div>

      {/* Breakpoints Section */}
      <div className="border-b border-surface0">
        <div className="px-3 py-1 bg-surface0/30 flex items-center justify-between">
          <span className="text-subtext0 uppercase tracking-wider text-2xs font-medium">
            Breakpoints ({breakpoints.length})
          </span>
        </div>
        <div className="max-h-24 overflow-auto">
          {breakpoints.length === 0 ? (
            <div className="px-3 py-2 text-overlay0 text-2xs">Click gutter to add breakpoints</div>
          ) : (
            breakpoints.map((bp, i) => {
              const fileName = bp.file.split(/[\\/]/).pop() ?? bp.file
              return (
                <div key={i} className="group flex items-center gap-2 px-3 py-1 hover:bg-surface0/30">
                  <span className="w-2 h-2 rounded-full bg-red flex-shrink-0" />
                  <span className="text-text truncate flex-1">{fileName}</span>
                  <span className="text-overlay0">:{bp.line}</span>
                  <button
                    onClick={() => setBreakpoints((prev) => prev.filter((_, j) => j !== i))}
                    className="hidden group-hover:block text-overlay0 hover:text-red"
                  >
                    ×
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Variables Section */}
      <div className="border-b border-surface0">
        <div className="px-3 py-1 bg-surface0/30">
          <span className="text-subtext0 uppercase tracking-wider text-2xs font-medium">Variables</span>
        </div>
        <div className="max-h-32 overflow-auto">
          {variables.length === 0 ? (
            <div className="px-3 py-2 text-overlay0 text-2xs">
              {debugState === 'paused' ? 'No variables in scope' : 'Start debugging to inspect variables'}
            </div>
          ) : (
            variables.map((v, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-0.5 hover:bg-surface0/30 font-mono">
                <span className="text-blue">{v.name}</span>
                <span className="text-overlay0">=</span>
                <span className="text-green truncate">{v.value}</span>
                <span className="text-overlay0 text-2xs ml-auto">{v.type}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Call Stack */}
      <div className="border-b border-surface0">
        <div className="px-3 py-1 bg-surface0/30">
          <span className="text-subtext0 uppercase tracking-wider text-2xs font-medium">Call Stack</span>
        </div>
        <div className="max-h-24 overflow-auto">
          {callStack.length === 0 ? (
            <div className="px-3 py-2 text-overlay0 text-2xs">No call stack</div>
          ) : (
            callStack.map((frame, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-0.5 hover:bg-surface0/30 cursor-pointer">
                <span className="text-text">{frame.name}</span>
                <span className="text-overlay0 text-2xs ml-auto">
                  {frame.file.split(/[\\/]/).pop()}:{frame.line}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Debug Output / Console */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-3 py-1 bg-surface0/30 flex-shrink-0">
          <span className="text-subtext0 uppercase tracking-wider text-2xs font-medium">Debug Console</span>
        </div>
        <div className="flex-1 overflow-auto px-3 py-1 font-mono text-2xs">
          {output.length === 0 ? (
            <span className="text-overlay0">Ready to debug</span>
          ) : (
            output.map((line, i) => (
              <div key={i} className="text-subtext1 py-0.5 whitespace-pre-wrap">{line}</div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
