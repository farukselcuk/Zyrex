import { useRef, useState, useCallback, useEffect } from 'react'
import { useAIStore, useEditorStore } from '../../store'
import ModelSelector from '../ModelSelector'
import type { ChatMessage } from '../../types'

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const { openTab } = useEditorStore()

  // Extract code blocks for "Insert to editor" actions
  const parts = message.content.split(/(```[\s\S]*?```)/g)

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed selectable ${
          isUser
            ? 'bg-blue text-crust'
            : 'bg-surface0 text-text'
        }`}
      >
        {parts.map((part, i) => {
          if (part.startsWith('```')) {
            const match = part.match(/^```(\w*)\n?([\s\S]*?)```$/)
            const lang = match?.[1] ?? ''
            const code = match?.[2] ?? part
            return (
              <div key={i} className="my-2">
                <div className="flex items-center justify-between bg-crust rounded-t px-2 py-1 text-2xs text-overlay0">
                  <span>{lang || 'code'}</span>
                  <button
                    onClick={() => {
                      openTab(undefined as unknown as string, `snippet.${lang || 'txt'}`, code.trimEnd())
                    }}
                    className="hover:text-text transition-colors"
                    title="Open in editor"
                  >
                    ↗ Insert
                  </button>
                </div>
                <pre className="bg-[#11111b] rounded-b px-3 py-2 overflow-x-auto text-subtext1 font-mono text-2xs">
                  <code>{code}</code>
                </pre>
              </div>
            )
          }
          return <span key={i}>{part}</span>
        })}

        {message.isStreaming && (
          <span className="inline-block w-1.5 h-3 bg-current ml-0.5 cursor-blink" />
        )}
      </div>
    </div>
  )
}

// ─── AI Panel ─────────────────────────────────────────────────────────────────

export default function AIPanel({ backendPort }: { backendPort: number }) {
  const {
    activeConversationId,
    selectedModel,
    aiSettings,
    apiKeys,
    isStreaming,
    newConversation,
    addMessage,
    updateLastMessage,
    setStreaming,
    getActiveConversation,
  } = useAIStore()
  const { getActiveTab } = useEditorStore()

  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const conversation = getActiveConversation()
  const messages = conversation?.messages ?? []

  // Helper: get provider from model ID
  const getModelProvider = (modelId: string): string => {
    if (modelId.startsWith('claude')) return 'anthropic'
    if (modelId.startsWith('gemini')) return 'google'
    if (modelId.startsWith('llama') || modelId.startsWith('mixtral')) return 'groq'
    if (modelId.startsWith('ollama/')) return 'ollama'
    return 'openai'
  }

  // Helper: get API key for model
  const getApiKeyForModel = (modelId: string): string => {
    const provider = getModelProvider(modelId)
    return (apiKeys as Record<string, string | undefined>)[provider] || ''
  }

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Ensure there's always an active conversation
  useEffect(() => {
    if (!activeConversationId) newConversation()
  }, [activeConversationId, newConversation])

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }

  const handleStop = () => {
    abortRef.current?.abort()
    setStreaming(false)
  }

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    let convId = activeConversationId
    if (!convId) convId = newConversation()

    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    // Build context from open file
    let userContent = text
    if (aiSettings.includeOpenFileContext) {
      const activeTab = getActiveTab()
      if (activeTab?.content) {
        userContent = `[Context — ${activeTab.name}]\n\`\`\`${activeTab.language}\n${activeTab.content.slice(0, 6000)}\n\`\`\`\n\n${text}`
      }
    }

    addMessage(convId, { role: 'user', content: text })
    addMessage(convId, { role: 'assistant', content: '', isStreaming: true })

    setStreaming(true)
    abortRef.current = new AbortController()

    try {
      const response = await fetch(`http://127.0.0.1:${backendPort}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: aiSettings.systemPrompt },
            ...(conversation?.messages.map((m: ChatMessage) => ({ role: m.role, content: m.content })) ?? []),
            { role: 'user', content: userContent },
          ],
          model: selectedModel,
          provider: getModelProvider(selectedModel),
          apiKey: getApiKeyForModel(selectedModel),
          temperature: aiSettings.temperature,
          maxTokens: aiSettings.maxTokens,
        }),
        signal: abortRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data) as { delta: string }
            accumulated += parsed.delta
            updateLastMessage(convId!, accumulated)
          } catch {
            // ignore partial JSON
          }
        }
      }

      updateLastMessage(convId!, accumulated, true)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        updateLastMessage(
          convId!,
          `⚠️ Error: ${(err as Error).message}\n\nMake sure your API key is configured in Settings.`,
          true,
        )
      }
    } finally {
      setStreaming(false)
    }
  }, [
    input,
    isStreaming,
    activeConversationId,
    selectedModel,
    aiSettings,
    backendPort,
    conversation,
    newConversation,
    addMessage,
    updateLastMessage,
    setStreaming,
    getActiveTab,
  ])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface0 flex-shrink-0">
        <span className="text-2xs font-semibold uppercase tracking-widest text-overlay0">AI Chat</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={newConversation}
            title="New conversation"
            className="p-1 rounded text-overlay1 hover:text-text hover:bg-surface0 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="8" y1="3" x2="8" y2="13" />
              <line x1="3" y1="8" x2="13" y2="8" />
            </svg>
          </button>
        </div>
      </div>

      {/* Model selector */}
      <div className="px-3 py-2 border-b border-surface0 flex-shrink-0">
        <ModelSelector />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 selectable">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="text-4xl">⬡</div>
            <p className="text-xs text-overlay0">
              Ask me anything about your code.
              <br />
              The active file is automatically included as context.
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center mt-2">
              {['Explain this code', 'Find bugs', 'Add TypeScript types', 'Write tests'].map(
                (prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    className="text-2xs px-2 py-1 rounded border border-surface1 text-subtext0 hover:bg-surface0 hover:text-text transition-colors"
                  >
                    {prompt}
                  </button>
                ),
              )}
            </div>
          </div>
        ) : (
          messages.map((msg: ChatMessage) => <MessageBubble key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-surface0 p-3 bg-crust">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI... (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="flex-1 bg-surface0 text-text text-xs rounded-lg px-3 py-2 resize-none placeholder-overlay0 border border-surface1 focus:border-blue focus:outline-none transition-colors selectable"
            style={{ minHeight: '2.25rem', maxHeight: '7.5rem' }}
          />
          {isStreaming ? (
            <button
              onClick={handleStop}
              className="flex-shrink-0 w-8 h-8 rounded-lg bg-red/20 hover:bg-red/30 text-red flex items-center justify-center transition-colors"
              title="Stop"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <rect x="1" y="1" width="8" height="8" rx="1" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue hover:bg-sapphire disabled:opacity-30 text-crust flex items-center justify-center transition-colors"
              title="Send (Enter)"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 8l6-6 6 6M8 2v12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
