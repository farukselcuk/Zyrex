import { useState } from 'react'
import { useAppStore, useEditorStore, useEditorSettings } from '../store'
import SettingsPanel from './Settings'

export default function StatusBar() {
  const { projectPath } = useAppStore()
  const { getActiveTab } = useEditorStore()
  const { settings, update } = useEditorSettings()
  const [showSettings, setShowSettings] = useState(false)

  const activeTab = getActiveTab()

  return (
    <>
      <footer className="flex items-center justify-between h-6 bg-blue/90 text-crust text-2xs px-3 flex-shrink-0 select-none">
        {/* Left: project/branch info */}
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-medium">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zm0 9.5a.75.75 0 111.5 0 .75.75 0 01-1.5 0zm5.25-5a.75.75 0 100 1.5.75.75 0 000-1.5z"/>
              <path d="M6.5 3.25c0-.966.784-1.75 1.75-1.75S10 2.284 10 3.25c0 .765-.487 1.414-1.165 1.658v.342a.75.75 0 01-1.5 0v-.342A1.752 1.752 0 016.5 3.25z"/>
            </svg>
            main
          </span>
          {projectPath && (
            <span className="opacity-70 truncate max-w-48">
              {projectPath.split(/[/\\]/).pop()}
            </span>
          )}
        </div>

        {/* Right: language, spaces, encoding, settings */}
        <div className="flex items-center gap-4 opacity-90">
          {activeTab && (
            <>
              <span>{activeTab.language}</span>
              <button
                onClick={() => update({ tabSize: settings.tabSize === 2 ? 4 : 2 })}
                className="hover:opacity-100 opacity-80 transition-opacity"
              >
                Spaces: {settings.tabSize}
              </button>
              <span>UTF-8</span>
              {activeTab.isDirty && <span className="text-yellow font-medium">● Unsaved</span>}
            </>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="hover:opacity-100 opacity-80 transition-opacity flex items-center gap-1"
            title="Settings"
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 4.754a3.246 3.246 0 100 6.492 3.246 3.246 0 000-6.492zM5.754 8a2.246 2.246 0 114.492 0 2.246 2.246 0 01-4.492 0z"/>
              <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 01-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 01-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 01.52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 011.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 011.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 01.52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 01-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 01-1.255-.52l-.094-.319z"/>
            </svg>
          </button>
          <span className="opacity-60">NexusIDE v0.1.0</span>
        </div>
      </footer>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </>
  )
}
