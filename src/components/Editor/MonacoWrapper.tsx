import { useEffect, useRef } from 'react'
import MonacoEditor, { type OnMount, type BeforeMount } from '@monaco-editor/react'
import * as monacoNS from 'monaco-editor'
import { useEditorStore, useEditorSettings } from '../../store'
import { editorRefStore } from '../../store/editorRef'
import { registerInlineCompletions } from './inlineCompletions'

// ─── Per-tab model cache ──────────────────────────────────────────────────────
// Keeps one Monaco ITextModel per tab so switching tabs is instant (no remount)
const modelCache = new Map<string, monacoNS.editor.ITextModel>()
let snippetsRegistered = false

function registerSnippets(monaco: typeof monacoNS): void {
  if (snippetsRegistered) return
  snippetsRegistered = true

  const snippetsByLang: Record<string, Array<{label: string; insertText: string; detail: string}>> = {
    typescript: [
      { label: 'func', insertText: 'function ${1:name}(${2:params}): ${3:void} {\n\t$0\n}', detail: 'Function declaration' },
      { label: 'afunc', insertText: 'async function ${1:name}(${2:params}): Promise<${3:void}> {\n\t$0\n}', detail: 'Async function' },
      { label: 'iface', insertText: 'interface ${1:Name} {\n\t${2:prop}: ${3:type}\n}', detail: 'Interface' },
      { label: 'clazz', insertText: 'class ${1:Name} {\n\tconstructor(${2:params}) {\n\t\t$0\n\t}\n}', detail: 'Class' },
      { label: 'elog', insertText: 'console.log(${1:\'$2\'})', detail: 'console.log' },
      { label: 'trycatch', insertText: 'try {\n\t$1\n} catch (error) {\n\t$0\n}', detail: 'Try-catch block' },
      { label: 'imp', insertText: 'import { ${2:module} } from \'${1:package}\'', detail: 'Import statement' },
    ],
    typescriptreact: [
      { label: 'rfc', insertText: 'export default function ${1:Component}() {\n\treturn (\n\t\t<div>\n\t\t\t$0\n\t\t</div>\n\t)\n}', detail: 'React FC' },
      { label: 'usestate', insertText: 'const [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState(${2:initial})', detail: 'useState hook' },
      { label: 'useeffect', insertText: 'useEffect(() => {\n\t$1\n\treturn () => {\n\t\t$2\n\t}\n}, [${3:deps}])', detail: 'useEffect hook' },
      { label: 'usememo', insertText: 'const ${1:value} = useMemo(() => {\n\treturn $2\n}, [${3:deps}])', detail: 'useMemo hook' },
      { label: 'usecb', insertText: 'const ${1:handler} = useCallback(($2) => {\n\t$0\n}, [${3:deps}])', detail: 'useCallback hook' },
    ],
    javascript: [
      { label: 'func', insertText: 'function ${1:name}(${2:params}) {\n\t$0\n}', detail: 'Function declaration' },
      { label: 'afunc', insertText: 'async function ${1:name}(${2:params}) {\n\t$0\n}', detail: 'Async function' },
      { label: 'elog', insertText: 'console.log(${1:\'$2\'})', detail: 'console.log' },
      { label: 'trycatch', insertText: 'try {\n\t$1\n} catch (error) {\n\t$0\n}', detail: 'Try-catch block' },
      { label: 'forof', insertText: 'for (const ${1:item} of ${2:iterable}) {\n\t$0\n}', detail: 'for...of loop' },
    ],
    python: [
      { label: 'def', insertText: 'def ${1:name}(${2:params}):\n\t${0:pass}', detail: 'Function' },
      { label: 'adef', insertText: 'async def ${1:name}(${2:params}):\n\t${0:pass}', detail: 'Async function' },
      { label: 'cls', insertText: 'class ${1:Name}:\n\tdef __init__(self${2:, params}):\n\t\t${0:pass}', detail: 'Class' },
      { label: 'ifmain', insertText: 'if __name__ == \'__main__\':\n\t${0:main()}', detail: 'if __name__ == __main__' },
      { label: 'trycatch', insertText: 'try:\n\t$1\nexcept ${2:Exception} as e:\n\t$0', detail: 'Try-except block' },
    ],
    html: [
      { label: 'html5', insertText: '<!DOCTYPE html>\n<html lang="${1:en}">\n<head>\n\t<meta charset="UTF-8">\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0">\n\t<title>${2:Document}</title>\n</head>\n<body>\n\t$0\n</body>\n</html>', detail: 'HTML5 boilerplate' },
      { label: 'link', insertText: '<link rel="stylesheet" href="${1:style.css}">', detail: 'CSS link' },
      { label: 'script', insertText: '<script src="${1:script.js}"></script>', detail: 'Script tag' },
    ],
    css: [
      { label: 'flex-center', insertText: 'display: flex;\njustify-content: center;\nalign-items: center;', detail: 'Flexbox center' },
      { label: 'grid', insertText: 'display: grid;\ngrid-template-columns: ${1:repeat(3, 1fr)};\ngap: ${2:1rem};', detail: 'CSS Grid' },
      { label: 'media', insertText: '@media (max-width: ${1:768px}) {\n\t$0\n}', detail: 'Media query' },
    ],
  }

  // Also share TS snippets with TSX and JS with JSX
  snippetsByLang.javascriptreact = [...(snippetsByLang.javascript ?? []), ...(snippetsByLang.typescriptreact ?? [])]
  snippetsByLang.typescriptreact = [...(snippetsByLang.typescript ?? []), ...(snippetsByLang.typescriptreact ?? [])]

  for (const [lang, snippets] of Object.entries(snippetsByLang)) {
    monaco.languages.registerCompletionItemProvider(lang, {
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position)
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        }
        return {
          suggestions: snippets.map((s) => ({
            label: s.label,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: s.insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: s.detail,
            range,
          })),
        }
      },
    })
  }
}

function getOrCreateModel(
  tabId: string,
  content: string,
  language: string,
): monacoNS.editor.ITextModel {
  let model = modelCache.get(tabId)
  if (!model || model.isDisposed()) {
    model = monacoNS.editor.createModel(
      content,
      language,
      monacoNS.Uri.parse(`inmemory://tab/${tabId}`),
    )
    modelCache.set(tabId, model)
  }
  return model
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MonacoWrapper() {
  const tabs       = useEditorStore((s) => s.tabs)
  const activeTabId = useEditorStore((s) => s.activeTabId)
  const activeTab  = tabs.find((t) => t.id === activeTabId)
  const updateContent = useEditorStore((s) => s.updateContent)
  const { settings } = useEditorSettings()

  // Keep reference to active model's change subscription
  const contentSubRef = useRef<monacoNS.IDisposable | null>(null)

  // Cleanup disposed models when tabs are closed
  useEffect(() => {
    const tabIds = new Set(tabs.map((t) => t.id))
    for (const [id, model] of modelCache) {
      if (!tabIds.has(id)) {
        model.dispose()
        modelCache.delete(id)
      }
    }
  }, [tabs])

  // Switch model when active tab changes (no editor remount!)
  useEffect(() => {
    const editor = editorRefStore.get()
    if (!editor || !activeTab) return

    const model = getOrCreateModel(activeTab.id, activeTab.content, activeTab.language)

    // Only switch if needed
    if (editor.getModel() !== model) {
      editor.setModel(model)
    }

    // Subscribe to content changes for this tab
    contentSubRef.current?.dispose()
    contentSubRef.current = model.onDidChangeContent(() => {
      updateContent(activeTab.id, model.getValue())
    })

    return () => {
      contentSubRef.current?.dispose()
      contentSubRef.current = null
    }
  }, [activeTabId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      contentSubRef.current?.dispose()
      editorRefStore.set(null)
    }
  }, [])

  // ── Theme (defined once before mount) ──────────────────────────────────────
  const handleBeforeMount: BeforeMount = (monaco) => {
    if (monaco.editor.getEditors().length > 0) return // already defined
    monaco.editor.defineTheme('nexus-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment',  foreground: '4a4a4a', fontStyle: 'italic' },
        { token: 'keyword',  foreground: 'ad70ec' },
        { token: 'string',   foreground: '6acc70' },
        { token: 'number',   foreground: 'f09848' },
        { token: 'type',     foreground: '5ad4e8' },
        { token: 'class',    foreground: 'f0d068' },
        { token: 'function', foreground: '6b8ff7' },
        { token: 'operator', foreground: 'b8b8b8' },
      ],
      colors: {
        'editor.background':                 '#0f0f0f',
        'editor.foreground':                 '#e2e2e2',
        'editor.lineHighlightBackground':    '#1a1a1a',
        'editor.lineHighlightBorder':        '#00000000',
        'editorLineNumber.foreground':       '#3a3a3a',
        'editorLineNumber.activeForeground': '#6b8ff7',
        'editor.selectionBackground':        '#6b8ff730',
        'editor.inactiveSelectionBackground':'#6b8ff718',
        'editorCursor.foreground':           '#ad70ec',
        'editorIndentGuide.background1':     '#1e1e1e',
        'editorIndentGuide.activeBackground1':'#2e2e2e',
        'scrollbarSlider.background':        '#2e2e2e80',
        'scrollbarSlider.hoverBackground':   '#3a3a3a',
        'editorWidget.background':           '#080808',
        'editorWidget.border':               '#1a1a1a',
        'editorSuggestWidget.background':    '#080808',
        'editorSuggestWidget.border':        '#1a1a1a',
        'editorSuggestWidget.selectedBackground': '#1a1a1a',
        'input.background':                  '#1a1a1a',
        'input.border':                      '#2e2e2e',
        'focusBorder':                       '#6b8ff7',
      },
    })
  }

  // ── Mount (runs once) ───────────────────────────────────────────────────────
  const handleMount: OnMount = (editor, monaco) => {
    editorRefStore.set(editor)

    // Set the current active tab's model immediately
    const tab = useEditorStore.getState().getActiveTab()
    if (tab) {
      const model = getOrCreateModel(tab.id, tab.content, tab.language)
      editor.setModel(model)
      contentSubRef.current = model.onDidChangeContent(() => {
        updateContent(tab.id, model.getValue())
      })
    }

    // ── Ctrl+S — Save ────────────────────────────────────────────────────────
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
      const t = useEditorStore.getState().getActiveTab()
      if (!t) return
      if (t.path) {
        await window.nexusAPI.fs.writeFile(t.path, t.content)
        useEditorStore.getState().markSaved(t.id)
      } else {
        const savePath = await window.nexusAPI.fs.saveFile()
        if (!savePath) return
        await window.nexusAPI.fs.writeFile(savePath, t.content)
        const name = savePath.split(/[\\/]/).pop() ?? 'Untitled'
        useEditorStore.getState().updateTabPath(t.id, savePath, name)
      }
    })

    // ── Ctrl+Shift+F — Format ────────────────────────────────────────────────
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
      () => { editor.getAction('editor.action.formatDocument')?.run() },
    )

    // ── Register Code Snippets ───────────────────────────────────────────────
    registerSnippets(monaco)

    // ── Register AI Inline Completions (ghost text) ──────────────────────────
    registerInlineCompletions(monaco)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex-1 overflow-hidden flex flex-col">
      {/* Always-mounted Monaco editor (no key — avoids remounting on tab switch) */}
      <MonacoEditor
        theme="nexus-dark"
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        loading={
          <div className="flex-1 flex items-center justify-center text-overlay0 text-xs">
            Starting editor…
          </div>
        }
        options={{
          fontSize: settings.fontSize,
          fontFamily: settings.fontFamily,
          fontLigatures: true,
          tabSize: settings.tabSize,
          lineNumbers: settings.lineNumbers ? 'on' : 'off',
          glyphMargin: true,
          minimap: { enabled: settings.minimap },
          wordWrap: settings.wordWrap ? 'on' : 'off',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 12, bottom: 12 },
          scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
          suggest: { showSnippets: true },
          quickSuggestions: { other: true, comments: true, strings: true },
          bracketPairColorization: { enabled: true },
          formatOnPaste: true,
          formatOnType: false,
          renderLineHighlight: 'line',
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          // Multi-cursor
          multiCursorModifier: 'alt',
          multiCursorMergeOverlapping: true,
          // Snippets
          snippetSuggestions: 'top',
          // Inline completions (ghost text)
          inlineSuggest: { enabled: true },
        }}
        className="monaco-container"
      />

      {/* Empty-state overlay — when no file is open */}
      {!activeTab && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-base text-overlay0 select-none gap-4 pointer-events-none">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="opacity-20">
            <rect x="8" y="12" width="48" height="40" rx="4" stroke="currentColor" strokeWidth="2"/>
            <path d="M20 24h24M20 32h16M20 40h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="44" cy="40" r="6" stroke="currentColor" strokeWidth="2"/>
            <path d="M44 44l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <div className="text-center">
            <p className="text-sm font-medium text-subtext0">No file open</p>
            <p className="text-xs text-overlay0 mt-1">Open a file from the explorer or press Ctrl+O</p>
            <p className="text-xs text-overlay0 mt-0.5">New file: Ctrl+N</p>
          </div>
        </div>
      )}
    </div>
  )
}

