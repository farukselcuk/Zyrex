import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useAppStore } from '../../store'

// ─── Helpers ──────────────────────────────────────────────────────────────────

let idCounter = 0
function nextTermId(): string {
  return `term-${++idCounter}-${Date.now()}`
}

interface TerminalInstance {
  id: string
  label: string
  xterm: XTerm
  fitAddon: FitAddon
}

// ─── Terminal Panel ───────────────────────────────────────────────────────────

export default function TerminalPanel() {
  const projectPath = useAppStore((s) => s.projectPath)
  const containerRef = useRef<HTMLDivElement>(null)
  const [instances, setInstances] = useState<TerminalInstance[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const instancesRef = useRef<TerminalInstance[]>([])

  // Keep ref in sync
  useEffect(() => {
    instancesRef.current = instances
  }, [instances])

  const createTerminal = useCallback(() => {
    const id = nextTermId()
    const xterm = new XTerm({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", monospace',
      theme: {
        background: '#040404',
        foreground: '#cdd6f4',
        cursor: '#ad70ec',
        selectionBackground: 'rgba(108, 143, 247, 0.3)',
        black: '#0f0f0f',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#6b8ff7',
        magenta: '#cba6f7',
        cyan: '#94e2d5',
        white: '#cdd6f4',
        brightBlack: '#585b70',
        brightRed: '#f38ba8',
        brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af',
        brightBlue: '#89b4fa',
        brightMagenta: '#cba6f7',
        brightCyan: '#94e2d5',
        brightWhite: '#ffffff',
      },
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    xterm.loadAddon(fitAddon)

    const inst: TerminalInstance = {
      id,
      label: `Terminal ${instancesRef.current.length + 1}`,
      xterm,
      fitAddon,
    }

    setInstances((prev) => [...prev, inst])
    setActiveId(id)

    // Spawn PTY after a tick so the DOM is ready
    setTimeout(async () => {
      if (containerRef.current) {
        // Hide others, show this one
        const termEl = document.createElement('div')
        termEl.id = `xterm-${id}`
        termEl.style.width = '100%'
        termEl.style.height = '100%'
        containerRef.current.appendChild(termEl)
        xterm.open(termEl)
        fitAddon.fit()

        // Write to pty on user input
        xterm.onData((data: string) => {
          window.nexusAPI.terminal.write(id, data)
        })

        // Receive pty output
        const onData = (...args: unknown[]) => {
          const [termId, data] = args as [string, string]
          if (termId === id) xterm.write(data)
        }
        const onExit = (...args: unknown[]) => {
          const [termId] = args as [string]
          if (termId === id) {
            xterm.writeln('\r\n\x1b[90m[Process exited]\x1b[0m')
          }
        }
        window.nexusAPI.on('terminal:data', onData)
        window.nexusAPI.on('terminal:exit', onExit)

        // Spawn the shell
        const result = await window.nexusAPI.terminal.spawn(id, projectPath ?? undefined)
        if (!result.success) {
          xterm.writeln(`\x1b[31mFailed to start terminal: ${result.error}\x1b[0m`)
          xterm.writeln('\x1b[90mNote: Run "npm run rebuild" to compile node-pty for Electron.\x1b[0m')
        }
      }
    }, 50)

    return id
  }, [projectPath])

  // Create first terminal on mount
  useEffect(() => {
    if (instances.length === 0) {
      createTerminal()
    }
    // Cleanup on unmount
    return () => {
      instancesRef.current.forEach((inst) => {
        window.nexusAPI.terminal.kill(inst.id)
        inst.xterm.dispose()
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Switch visible terminal
  useEffect(() => {
    instances.forEach((inst) => {
      const el = document.getElementById(`xterm-${inst.id}`)
      if (el) {
        el.style.display = inst.id === activeId ? 'block' : 'none'
        if (inst.id === activeId) {
          inst.fitAddon.fit()
        }
      }
    })
  }, [activeId, instances])

  // Resize on window resize
  useEffect(() => {
    const handleResize = () => {
      const active = instances.find((i) => i.id === activeId)
      if (active) {
        active.fitAddon.fit()
        const dims = active.fitAddon.proposeDimensions()
        if (dims) {
          window.nexusAPI.terminal.resize(active.id, dims.cols, dims.rows)
        }
      }
    }
    window.addEventListener('resize', handleResize)
    // Also observe the container
    let observer: ResizeObserver | null = null
    if (containerRef.current) {
      observer = new ResizeObserver(handleResize)
      observer.observe(containerRef.current)
    }
    return () => {
      window.removeEventListener('resize', handleResize)
      observer?.disconnect()
    }
  }, [activeId, instances])

  const killTerminal = (id: string) => {
    window.nexusAPI.terminal.kill(id)
    const inst = instances.find((i) => i.id === id)
    if (inst) {
      inst.xterm.dispose()
      const el = document.getElementById(`xterm-${id}`)
      el?.remove()
    }
    setInstances((prev) => {
      const next = prev.filter((i) => i.id !== id)
      if (activeId === id) setActiveId(next[0]?.id ?? null)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full bg-crust">
      {/* Tab Bar */}
      <div className="flex items-center h-8 bg-mantle border-b border-surface0 px-1 gap-0.5 flex-shrink-0">
        {instances.map((inst) => (
          <div
            key={inst.id}
            onClick={() => setActiveId(inst.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-t text-xs cursor-pointer transition-colors ${
              inst.id === activeId ? 'bg-crust text-text' : 'text-overlay0 hover:text-text hover:bg-surface0'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 3a1 1 0 011-1h4l2 2h4a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V3z"/>
            </svg>
            <span>{inst.label}</span>
            <button
              onClick={(e) => { e.stopPropagation(); killTerminal(inst.id) }}
              className="ml-1 opacity-0 group-hover:opacity-100 hover:text-red transition-opacity"
              title="Kill terminal"
            >
              ×
            </button>
          </div>
        ))}
        {/* New terminal button */}
        <button
          onClick={createTerminal}
          className="flex items-center justify-center w-6 h-6 rounded text-overlay0 hover:text-text hover:bg-surface0 transition-colors ml-0.5"
          title="New Terminal"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 2v8M2 6h8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Terminal Container */}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden p-1" />
    </div>
  )
}
