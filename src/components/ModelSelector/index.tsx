import { useState } from 'react'
import { useAIStore } from '../../store'
import type { ModelProvider } from '../../types'

const PROVIDER_COLORS: Record<ModelProvider, string> = {
  openai:    'text-green',
  anthropic: 'text-peach',
  google:    'text-blue',
  groq:      'text-mauve',
  ollama:    'text-teal',
}

const PROVIDER_LABELS: Record<ModelProvider, string> = {
  openai:    'OpenAI',
  anthropic: 'Anthropic',
  google:    'Google',
  groq:      'Groq',
  ollama:    '⬡ Local',
}

export default function ModelSelector({ compact = false }: { compact?: boolean }) {
  const { selectedModel, availableModels, setSelectedModel } = useAIStore()
  const [open, setOpen] = useState(false)

  const current = availableModels.find((m) => m.id === selectedModel)
  const byProvider = availableModels.reduce<Record<string, typeof availableModels>>(
    (acc: Record<string, typeof availableModels>, model) => {
      ;(acc[model.provider] ??= []).push(model)
      return acc
    },
    {},
  )

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs border border-surface1 bg-surface0 hover:bg-surface1 transition-colors ${compact ? '' : 'w-full'}`}
      >
        <span className={current ? PROVIDER_COLORS[current.provider] : 'text-overlay0'}>●</span>
        <span className="text-subtext1 max-w-36 truncate">{current?.name ?? 'Select model'}</span>
        <svg className="w-3 h-3 text-overlay0 ml-auto" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-mantle border border-surface0 rounded-lg shadow-2xl overflow-hidden fade-in">
            {(Object.keys(byProvider) as ModelProvider[]).map((provider) => (
              <div key={provider}>
                <div className="px-3 py-1.5 text-2xs font-semibold uppercase tracking-widest text-overlay0 bg-crust">
                  {PROVIDER_LABELS[provider]}
                </div>
                {byProvider[provider].map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      setSelectedModel(model.id)
                      setOpen(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-surface0 transition-colors flex items-center justify-between gap-2 ${
                      model.id === selectedModel ? 'bg-surface0 text-text' : 'text-subtext1'
                    }`}
                  >
                    <span>{model.name}</span>
                    {model.contextWindow && (
                      <span className="text-overlay0 text-2xs flex-shrink-0">
                        {model.contextWindow >= 1_000_000
                          ? `${model.contextWindow / 1_000_000}M`
                          : `${model.contextWindow / 1000}K`}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
