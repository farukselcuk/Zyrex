import { useState } from 'react'
import { useAIStore } from '../../store'

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { apiKeys, setApiKey, aiSettings, setAISettings } = useAIStore()
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})

  const providers = [
    { key: 'openai' as const, label: 'OpenAI', placeholder: 'sk-...' },
    { key: 'anthropic' as const, label: 'Anthropic', placeholder: 'sk-ant-...' },
    { key: 'google' as const, label: 'Google AI', placeholder: 'AI...' },
    { key: 'groq' as const, label: 'Groq', placeholder: 'gsk_...' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-mantle border border-surface0 rounded-xl w-[540px] max-h-[80vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface0">
          <h2 className="text-sm font-semibold text-text">Settings</h2>
          <button onClick={onClose} className="text-overlay0 hover:text-text transition-colors text-lg">×</button>
        </div>

        <div className="px-5 py-4 space-y-6">
          {/* API Keys */}
          <section>
            <h3 className="text-xs font-semibold text-overlay0 uppercase tracking-wider mb-3">API Keys</h3>
            <div className="space-y-3">
              {providers.map((p) => (
                <div key={p.key}>
                  <label className="text-xs text-subtext1 mb-1 block">{p.label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type={showKeys[p.key] ? 'text' : 'password'}
                      value={apiKeys[p.key] || ''}
                      onChange={(e) => setApiKey(p.key, e.target.value)}
                      placeholder={p.placeholder}
                      className="flex-1 bg-surface0 border border-surface1 rounded-lg px-3 py-1.5 text-xs text-text placeholder-overlay0 outline-none focus:border-blue transition-colors"
                    />
                    <button
                      onClick={() => setShowKeys((s) => ({ ...s, [p.key]: !s[p.key] }))}
                      className="text-2xs text-overlay0 hover:text-text px-2 py-1 rounded bg-surface0"
                    >
                      {showKeys[p.key] ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* AI Settings */}
          <section>
            <h3 className="text-xs font-semibold text-overlay0 uppercase tracking-wider mb-3">AI Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-subtext1 mb-1 block">
                  Temperature: {aiSettings.temperature.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={aiSettings.temperature}
                  onChange={(e) => setAISettings({ temperature: parseFloat(e.target.value) })}
                  className="w-full accent-blue"
                />
              </div>
              <div>
                <label className="text-xs text-subtext1 mb-1 block">Max Tokens</label>
                <input
                  type="number"
                  value={aiSettings.maxTokens}
                  onChange={(e) => setAISettings({ maxTokens: parseInt(e.target.value) || 4096 })}
                  className="w-full bg-surface0 border border-surface1 rounded-lg px-3 py-1.5 text-xs text-text outline-none focus:border-blue"
                />
              </div>
              <div>
                <label className="text-xs text-subtext1 mb-1 block">System Prompt</label>
                <textarea
                  value={aiSettings.systemPrompt}
                  onChange={(e) => setAISettings({ systemPrompt: e.target.value })}
                  rows={4}
                  className="w-full bg-surface0 border border-surface1 rounded-lg px-3 py-1.5 text-xs text-text outline-none focus:border-blue resize-none"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-subtext1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiSettings.includeOpenFileContext}
                  onChange={(e) => setAISettings({ includeOpenFileContext: e.target.checked })}
                  className="rounded accent-blue"
                />
                Include open file as context
              </label>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
