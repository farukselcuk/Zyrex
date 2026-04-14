/**
 * ai.ts — AI Gateway with Agentic Tools
 *
 * Routes:
 * - POST /api/ai/chat        — streaming SSE chat completions
 * - GET  /api/ai/models      — list available models
 * - POST /api/ai/agent       — agentic loop (plan → execute → verify)
 */

import { Router, type Request, type Response } from 'express'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'

export const aiRouter = Router()

// ─── Tool Definitions (for Agentic Mode) ──────────────────────────────────────

interface ToolResult {
  tool: string
  result: string
  success: boolean
}

// Tools that the AI agent can use
async function executeAgentTool(
  name: string,
  args: Record<string, string>,
  projectRoot: string,
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'readFile': {
        const filePath = path.resolve(projectRoot, args.path)
        // Security: prevent path traversal outside project
        if (!filePath.startsWith(projectRoot)) {
          return { tool: name, result: 'Access denied: path outside project', success: false }
        }
        const content = await fs.readFile(filePath, 'utf-8')
        return { tool: name, result: content, success: true }
      }

      case 'writeFile': {
        const filePath = path.resolve(projectRoot, args.path)
        if (!filePath.startsWith(projectRoot)) {
          return { tool: name, result: 'Access denied: path outside project', success: false }
        }
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, args.content, 'utf-8')
        return { tool: name, result: `File written: ${args.path}`, success: true }
      }

      case 'listDir': {
        const dirPath = path.resolve(projectRoot, args.path || '.')
        if (!dirPath.startsWith(projectRoot)) {
          return { tool: name, result: 'Access denied: path outside project', success: false }
        }
        const entries = await fs.readdir(dirPath, { withFileTypes: true })
        const list = entries
          .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules')
          .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
          .join('\n')
        return { tool: name, result: list, success: true }
      }

      case 'runCommand': {
        const cmd = args.command
        // Block dangerous commands
        const blocked = ['rm -rf /', 'format', 'del /s', 'mkfs']
        if (blocked.some((b) => cmd.includes(b))) {
          return { tool: name, result: 'Command blocked for safety', success: false }
        }
        try {
          const output = execSync(cmd, {
            cwd: projectRoot,
            encoding: 'utf-8',
            maxBuffer: 2 * 1024 * 1024,
            timeout: 30000,
          })
          return { tool: name, result: output.slice(0, 5000), success: true }
        } catch (err) {
          return { tool: name, result: String((err as Error).message).slice(0, 2000), success: false }
        }
      }

      case 'searchInFiles': {
        const query = args.query
        try {
          const cmd = process.platform === 'win32'
            ? `findstr /S /I /N /P "${query.replace(/"/g, '')}" "${projectRoot}\\*.*"`
            : `grep -rn --include='*' -i "${query.replace(/"/g, '')}" "${projectRoot}"`
          const output = execSync(cmd, {
            encoding: 'utf-8',
            maxBuffer: 2 * 1024 * 1024,
            timeout: 10000,
          })
          return { tool: name, result: output.split('\n').slice(0, 50).join('\n'), success: true }
        } catch {
          return { tool: name, result: 'No matches found', success: false }
        }
      }

      default:
        return { tool: name, result: `Unknown tool: ${name}`, success: false }
    }
  } catch (err) {
    return { tool: name, result: String((err as Error).message), success: false }
  }
}

// OpenAI tool schemas
const OPENAI_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'readFile',
      description: 'Read the contents of a file in the project',
      parameters: { type: 'object', properties: { path: { type: 'string', description: 'Relative file path' } }, required: ['path'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'writeFile',
      description: 'Write content to a file in the project (creates directories if needed)',
      parameters: { type: 'object', properties: { path: { type: 'string', description: 'Relative file path' }, content: { type: 'string', description: 'File content' } }, required: ['path', 'content'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listDir',
      description: 'List files and directories in a path',
      parameters: { type: 'object', properties: { path: { type: 'string', description: 'Relative directory path (default: project root)' } }, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'runCommand',
      description: 'Run a shell command in the project directory',
      parameters: { type: 'object', properties: { command: { type: 'string', description: 'The shell command to execute' } }, required: ['command'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchInFiles',
      description: 'Search for text in project files',
      parameters: { type: 'object', properties: { query: { type: 'string', description: 'Search query' } }, required: ['query'] },
    },
  },
]

// Anthropic tool schemas (v0.20.x compatible — use raw objects)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ANTHROPIC_TOOLS: any[] = [
  {
    name: 'readFile',
    description: 'Read the contents of a file in the project',
    input_schema: { type: 'object', properties: { path: { type: 'string', description: 'Relative file path' } }, required: ['path'] },
  },
  {
    name: 'writeFile',
    description: 'Write content to a file in the project',
    input_schema: { type: 'object', properties: { path: { type: 'string', description: 'Relative file path' }, content: { type: 'string', description: 'File content' } }, required: ['path', 'content'] },
  },
  {
    name: 'listDir',
    description: 'List files and directories in a path',
    input_schema: { type: 'object', properties: { path: { type: 'string', description: 'Relative directory path' } }, required: [] },
  },
  {
    name: 'runCommand',
    description: 'Run a shell command in the project directory',
    input_schema: { type: 'object', properties: { command: { type: 'string', description: 'The shell command to execute' } }, required: ['command'] },
  },
  {
    name: 'searchInFiles',
    description: 'Search for text in project files',
    input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Search query' } }, required: ['query'] },
  },
]

// ─── Streaming Chat Route ─────────────────────────────────────────────────────

aiRouter.post('/chat', async (req: Request, res: Response) => {
  const { messages, model, temperature = 0.7, maxTokens = 4096, apiKey, provider } = req.body

  if (!messages || !model) {
    res.status(400).json({ error: 'messages and model are required' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    if (provider === 'anthropic') {
      if (!apiKey) { res.status(400).json({ error: 'Anthropic API key required' }); return }
      const client = new Anthropic({ apiKey })
      const systemMsg = messages.find((m: { role: string }) => m.role === 'system')
      const userMsgs = messages.filter((m: { role: string }) => m.role !== 'system')

      const stream = client.messages.stream({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemMsg?.content || '',
        messages: userMsgs.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      })

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          const delta = event.delta
          if ('text' in delta) {
            res.write(`data: ${JSON.stringify({ delta: delta.text })}\n\n`)
          }
        }
      }
    } else {
      // OpenAI-compatible (OpenAI, Groq, Ollama)
      const baseURL =
        provider === 'groq' ? 'https://api.groq.com/openai/v1' :
        provider === 'ollama' ? 'http://localhost:11434/v1' :
        undefined
      
      if (!apiKey && provider !== 'ollama') { res.status(400).json({ error: 'API key required' }); return }
      
      const client = new OpenAI({
        apiKey: apiKey || 'ollama',
        ...(baseURL ? { baseURL } : {}),
      })

      const stream = await client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      })

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content
        if (delta) {
          res.write(`data: ${JSON.stringify({ delta })}\n\n`)
        }
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    const msg = (err as Error).message
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`)
    res.end()
  }
})

// ─── Agentic Route (Plan → Execute → Verify) ─────────────────────────────────

aiRouter.post('/agent', async (req: Request, res: Response) => {
  const {
    messages,
    model,
    temperature = 0.3,
    maxTokens = 4096,
    apiKey,
    provider,
    projectRoot,
    maxIterations = 10,
  } = req.body

  if (!messages || !model || !projectRoot) {
    res.status(400).json({ error: 'messages, model, projectRoot are required' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const sendEvent = (type: string, data: unknown) => {
    res.write(`data: ${JSON.stringify({ type, ...data as object })}\n\n`)
  }

  try {
    if (provider === 'anthropic') {
      if (!apiKey) { res.status(400).json({ error: 'API key required' }); return }
      const client = new Anthropic({ apiKey })
      const systemMsg = messages.find((m: { role: string }) => m.role === 'system')
      const userMsgs = messages.filter((m: { role: string }) => m.role !== 'system')

      let agentMessages = userMsgs.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

      for (let i = 0; i < maxIterations; i++) {
        sendEvent('iteration', { iteration: i + 1 })

        const response = await client.messages.create({
          model,
          max_tokens: maxTokens,
          temperature,
          system: systemMsg?.content || '',
          messages: agentMessages,
          tools: ANTHROPIC_TOOLS,
        })

        // Process content blocks
        let textContent = ''
        const toolUses: Array<{ id: string; name: string; input: Record<string, string> }> = []

        for (const block of response.content) {
          if (block.type === 'text') {
            textContent += block.text
            sendEvent('text', { delta: block.text })
          } else if (block.type === 'tool_use') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tb = block as any
            toolUses.push({ id: tb.id, name: tb.name, input: tb.input as Record<string, string> })
          }
        }

        if (toolUses.length === 0 || response.stop_reason === 'end_turn') {
          sendEvent('done', { finalText: textContent })
          break
        }

        // Execute tools and feed results back
        agentMessages = [
          ...agentMessages,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { role: 'assistant' as const, content: response.content as any },
        ]

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolResults: any[] = []
        for (const tool of toolUses) {
          sendEvent('tool', { name: tool.name, args: tool.input })
          const result = await executeAgentTool(tool.name, tool.input, projectRoot)
          sendEvent('toolResult', { name: tool.name, success: result.success, result: result.result.slice(0, 500) })
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tool.id,
            content: result.result,
          })
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        agentMessages.push({ role: 'user' as const, content: toolResults as any })
      }
    } else {
      // OpenAI-compatible agent loop
      const baseURL =
        provider === 'groq' ? 'https://api.groq.com/openai/v1' :
        provider === 'ollama' ? 'http://localhost:11434/v1' :
        undefined

      if (!apiKey && provider !== 'ollama') { res.status(400).json({ error: 'API key required' }); return }

      const client = new OpenAI({
        apiKey: apiKey || 'ollama',
        ...(baseURL ? { baseURL } : {}),
      })

      let agentMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages

      for (let i = 0; i < maxIterations; i++) {
        sendEvent('iteration', { iteration: i + 1 })

        const response = await client.chat.completions.create({
          model,
          messages: agentMessages,
          temperature,
          max_tokens: maxTokens,
          tools: OPENAI_TOOLS,
        })

        const choice = response.choices[0]
        const msg = choice.message

        if (msg.content) {
          sendEvent('text', { delta: msg.content })
        }

        if (!msg.tool_calls || msg.tool_calls.length === 0 || choice.finish_reason === 'stop') {
          sendEvent('done', { finalText: msg.content || '' })
          break
        }

        agentMessages = [...agentMessages, msg]

        for (const tc of msg.tool_calls) {
          const args = JSON.parse(tc.function.arguments)
          sendEvent('tool', { name: tc.function.name, args })
          const result = await executeAgentTool(tc.function.name, args, projectRoot)
          sendEvent('toolResult', { name: tc.function.name, success: result.success, result: result.result.slice(0, 500) })
          agentMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: result.result,
          })
        }
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    sendEvent('error', { message: (err as Error).message })
    res.end()
  }
})

// ─── Models Route ─────────────────────────────────────────────────────────────

aiRouter.get('/models', (_req: Request, res: Response) => {
  res.json({
    models: [
      { id: 'gpt-4o', provider: 'openai' },
      { id: 'gpt-4o-mini', provider: 'openai' },
      { id: 'o1', provider: 'openai' },
      { id: 'o3-mini', provider: 'openai' },
      { id: 'claude-3-5-sonnet-20241022', provider: 'anthropic' },
      { id: 'claude-3-5-haiku-20241022', provider: 'anthropic' },
      { id: 'claude-opus-4-5', provider: 'anthropic' },
      { id: 'gemini-2.0-flash-exp', provider: 'google' },
      { id: 'gemini-1.5-pro', provider: 'google' },
      { id: 'llama-3.3-70b-versatile', provider: 'groq' },
      { id: 'mixtral-8x7b-32768', provider: 'groq' },
    ],
  })
})
