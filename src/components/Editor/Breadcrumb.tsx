import { useEditorStore, useAppStore } from '../../store'

export default function Breadcrumb() {
  const activeTab = useEditorStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId)
    return tab
  })
  const projectPath = useAppStore((s) => s.projectPath)

  if (!activeTab?.path) return null

  // Build relative path segments
  let relativePath = activeTab.path
  if (projectPath && relativePath.startsWith(projectPath)) {
    relativePath = relativePath.slice(projectPath.length).replace(/^[\\/]/, '')
  }
  const segments = relativePath.split(/[\\/]/)

  return (
    <div className="flex items-center h-6 px-3 bg-base border-b border-surface0 text-2xs text-subtext0 select-none overflow-hidden flex-shrink-0">
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center min-w-0">
          {i > 0 && (
            <svg width="12" height="12" viewBox="0 0 16 16" className="mx-0.5 text-overlay0 flex-shrink-0" fill="currentColor">
              <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          <span
            className={`truncate ${
              i === segments.length - 1 ? 'text-text font-medium' : 'hover:text-text transition-colors cursor-default'
            }`}
          >
            {seg}
          </span>
        </span>
      ))}
    </div>
  )
}
