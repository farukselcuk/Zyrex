/**
 * inlineCompletions.ts — Monaco InlineCompletionsProvider powered by AI
 *
 * Registers a ghost-text provider that calls the backend /api/ai/complete
 * endpoint and shows suggestions as translucent inline text (Tab to accept).
 */
import * as monaco from 'monaco-editor'
import { useAIStore, useAppStore } from '../../store'
import { AVAILABLE_MODELS } from '../../types'

let registered = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// Determine provider from model ID
function getProvider(modelId: string): string {
  const m = AVAILABLE_MODELS.find((am) => am.id === modelId)
  return m?.provider ?? 'openai'
}

function getApiKey(provider: string): string | undefined {
  const keys = useAIStore.getState().apiKeys
  return keys[provider as keyof typeof keys]
}

export function registerInlineCompletions(mon: typeof monaco): void {
  if (registered) return
  registered = true

  mon.languages.registerInlineCompletionsProvider({ pattern: '**' }, {
    provideInlineCompletions: async (model, position, _context, token) => {
      // Don't trigger on very short content
      const lineContent = model.getLineContent(position.lineNumber)
      if (lineContent.trim().length < 3 && position.lineNumber < 3) {
        return { items: [] }
      }

      // Debounce — wait for user to stop typing
      if (debounceTimer) clearTimeout(debounceTimer)

      return new Promise((resolve) => {
        debounceTimer = setTimeout(async () => {
          if (token.isCancellationRequested) {
            resolve({ items: [] })
            return
          }

          const selectedModel = useAIStore.getState().selectedModel
          const provider = getProvider(selectedModel)
          const apiKey = getApiKey(provider)

          // Need API key (except for ollama)
          if (!apiKey && provider !== 'ollama') {
            resolve({ items: [] })
            return
          }

          const backendPort = useAppStore.getState().backendPort

          // Get prefix (text before cursor) and suffix (text after cursor)
          const fullText = model.getValue()
          const offset = model.getOffsetAt(position)
          const prefix = fullText.substring(0, offset)
          const suffix = fullText.substring(offset)
          const language = model.getLanguageId()

          try {
            const response = await fetch(`http://127.0.0.1:${backendPort}/api/ai/complete`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prefix,
                suffix,
                language,
                model: selectedModel,
                apiKey,
                provider,
              }),
              signal: token.isCancellationRequested ? AbortSignal.abort() : undefined,
            })

            if (!response.ok || token.isCancellationRequested) {
              resolve({ items: [] })
              return
            }

            const data = await response.json()
            const completion = data.completion

            if (!completion || token.isCancellationRequested) {
              resolve({ items: [] })
              return
            }

            resolve({
              items: [
                {
                  insertText: completion,
                  range: new mon.Range(
                    position.lineNumber,
                    position.column,
                    position.lineNumber,
                    position.column,
                  ),
                },
              ],
            })
          } catch {
            resolve({ items: [] })
          }
        }, 750) // 750ms debounce
      })
    },
    freeInlineCompletions: () => {
      // cleanup if needed
    },
  })
}
