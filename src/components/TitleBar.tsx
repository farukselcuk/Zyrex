import type { ReactNode } from 'react'
import { useAppStore } from '../store'
import ModelSelector from './ModelSelector'

export default function TitleBar() {
  const { toggleFileTree, toggleAIPanel, projectPath } = useAppStore()

  const projectName = projectPath
    ? projectPath.split(/[/\\]/).pop() ?? 'NexusIDE'
    : 'NexusIDE'

  return (
    <header className="drag-region flex items-center h-10 bg-crust border-b border-surface0 px-3 gap-2 flex-shrink-0 select-none">
      {/* App logo / name */}
      <div className="no-drag flex items-center gap-2 mr-2">
        <span className="text-blue font-bold text-sm tracking-tight">⬡ NexusIDE</span>
      </div>

      {/* Traffic-light placeholder on macOS (Electron adds real ones) */}
      <div className="flex-1 flex items-center justify-center">
        <span className="text-overlay0 text-xs">{projectName}</span>
      </div>

      {/* Right controls */}
      <div className="no-drag flex items-center gap-1">
        {/* Toggle File Tree  Ctrl+B */}
        <BarButton
          title="Toggle File Tree (Ctrl+B)"
          onClick={toggleFileTree}
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="3" width="14" height="1.5" rx="0.75" />
              <rect x="1" y="7.25" width="14" height="1.5" rx="0.75" />
              <rect x="1" y="11.5" width="14" height="1.5" rx="0.75" />
            </svg>
          }
        />
        {/* Toggle AI Panel  Ctrl+Shift+A */}
        <BarButton
          title="Toggle AI Panel (Ctrl+Shift+A)"
          onClick={toggleAIPanel}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a7 7 0 0 1 7 7c0 3.5-2 6-5 7.5V19a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2.5C7 15 5 12.5 5 9a7 7 0 0 1 7-7z" />
              <line x1="9" y1="22" x2="15" y2="22" />
            </svg>
          }
        />

        {/* Model indicator */}
        <div className="no-drag ml-1">
          <ModelSelector compact />
        </div>
      </div>
    </header>
  )
}

function BarButton({
  icon,
  title,
  onClick,
}: {
  icon: ReactNode
  title: string
  onClick: () => void
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="no-drag p-1.5 rounded text-overlay2 hover:text-text hover:bg-surface0 transition-colors"
    >
      {icon}
    </button>
  )
}
