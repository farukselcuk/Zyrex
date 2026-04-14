/**
 * Monaco Editor setup — MUST be imported before any Monaco/editor component.
 *
 * 1. Configures @monaco-editor/react to use the BUNDLED monaco-editor package
 *    instead of trying to download it from CDN (which causes infinite "Loading...").
 *
 * 2. Provides Vite-bundled web workers so language features (TS, JSON, CSS, HTML)
 *    work correctly in the Electron renderer process.
 */

import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

// Workers — Vite bundles these as separate chunks via ?worker
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import tsWorker     from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import jsonWorker   from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker    from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker   from 'monaco-editor/esm/vs/language/html/html.worker?worker'

// Tell Monaco which worker to use per language
window.MonacoEnvironment = {
  getWorker(_moduleId: unknown, label: string): Worker {
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    if (label === 'json')                                  return new jsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
    return new editorWorker()
  },
}

// Use the locally bundled monaco instead of the AMD CDN loader
loader.config({ monaco })
