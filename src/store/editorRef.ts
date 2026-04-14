import type { editor } from 'monaco-editor'

/**
 * Module-level singleton that holds the active Monaco editor instance.
 * MonacoWrapper sets this on mount; EditorArea reads it for context menu actions.
 */
let _editor: editor.IStandaloneCodeEditor | null = null

export const editorRefStore = {
  get: (): editor.IStandaloneCodeEditor | null => _editor,
  set: (e: editor.IStandaloneCodeEditor | null): void => { _editor = e },
}
