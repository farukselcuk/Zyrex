# Zyrex IDE

<div align="center">

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Electron](https://img.shields.io/badge/Electron-29-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white)
![Monaco](https://img.shields.io/badge/Monaco_Editor-0.45-68217A)

**AI-Powered Desktop IDE — Built from Scratch**

*Monaco Editor • Multi-LLM Chat • Agentic AI Tools • Git • Debug • RAG • Integrated Terminal*

</div>

---

## ✨ Features

### 🖥️ Editor
- **Monaco Editor** — VS Code's core editor engine with full syntax highlighting, IntelliSense, and multi-language support
- **Model-cached tab switching** — Instant tab switches without re-mounting the editor
- **Keyboard shortcuts** — `Ctrl+S` save, `Ctrl+N` new file, `Ctrl+O` open, `Ctrl+Shift+F` format
- **Diff View** — Side-by-side diff editor with Accept/Reject controls for AI-generated changes

### 📁 File Explorer
- **Full file tree** with lazy-loaded directories
- **Drag & Drop** — Move files/folders by dragging
- **Inline rename** — Double-click to rename files
- **Context menu** — New File, New Folder, Rename, Copy Path, Delete, Open in Browser (HTML), Show in File Explorer
- **Persistent state** — Sidebar toggle doesn't lose the file tree

### 🤖 AI Integration
- **Multi-LLM support** — OpenAI (GPT-4o, o1, o3), Anthropic (Claude 3.5/Opus), Google (Gemini), Groq (LLaMA, Mixtral), Ollama (local)
- **Streaming SSE chat** — Real-time response streaming
- **Agentic AI Loop** — AI can autonomously:
  - 📖 Read project files (`readFile`)
  - ✏️ Write/create files (`writeFile`)
  - 📂 List directories (`listDir`)
  - ⚡ Run shell commands (`runCommand`)
  - 🔍 Search across codebase (`searchInFiles`)
- **Context-aware** — Automatically includes the active file as context
- **Code insertion** — Insert AI-generated code blocks directly into the editor

### 🔍 Search
- **Project-wide search** panel (`Ctrl+Shift+F`)
- Click results to jump directly to the file and line

### 💻 Terminal
- **xterm.js + node-pty** — Full terminal emulator inside the IDE
- **Multi-tab terminals** — Create and manage multiple terminal sessions
- **Auto-fit** — Responsive resize with the panel
- Toggle with `Ctrl+``

### ⚙️ Settings
- **API Key management** — Configure keys for OpenAI, Anthropic, Google, Groq
- **AI tuning** — Temperature, max tokens, system prompt customization
- **Editor settings** — Font size, tab size, line numbers, minimap, word wrap

### 🔀 Git Integration
- **Source Control panel** — View changed/staged/unstaged files
- **Stage & Unstage** — Individual file staging with one-click actions
- **Commit** — Commit message input with `Ctrl+Enter` shortcut
- **Push / Pull** — Sync with remote directly from the panel
- **Discard changes** — Revert uncommitted file changes
- **History** — Git log with commit hash, author, and relative time
- **Branch management** — View and switch branches

### 🐛 Debug Integration
- **Breakpoint gutter** — Click the glyph margin to toggle breakpoints
- **Visual breakpoint decorations** — Red dot + highlighted line in editor
- **Debug panel** — Breakpoints list, variables, call stack, debug console
- **Start/Stop** — Launch Node.js (`--inspect-brk`) or Python (`pdb`) debug sessions

### 🧠 RAG Context Engine
- **TF-IDF indexing** — Automatic codebase indexing on project open
- **Context enrichment** — AI chat queries are enriched with relevant code snippets
- **Chunked analysis** — Files split into overlapping 50-line chunks for precise retrieval
- **Lightweight** — No external vector DB needed; runs in-process

### ✨ Inline AI Completions
- **Ghost text suggestions** — AI-powered code completions appear as you type
- **750ms debounce** — Intelligent trigger to avoid excessive API calls
- **Multi-provider** — Works with any configured LLM (OpenAI, Anthropic, etc.)
- **Context-aware** — Sends prefix, suffix, and language for accurate completions

### 📝 Snippets & Multi-Cursor
- **Built-in snippets** — Language-specific (React: `rfc`, `usestate`, `useeffect`; Python: `def`, `class`, `ifmain`; HTML/CSS)
- **Multi-cursor editing** — `Alt+Click` for multiple cursors
- **Snippet suggestions** — Snippets prioritized at top of autocomplete

### 🧭 Breadcrumb Navigation
- **File path breadcrumb** — Shows current file path as clickable segments above the editor

### 🎨 UI/UX
- **Pure black/charcoal theme** — Custom dark theme (#0f0f0f base)
- **Activity bar** — VS Code-style icon strip (Explorer, Search, Git, Debug, Terminal, AI)
- **Resizable panels** — File tree, AI chat, terminal
- **Status bar** — Language, encoding, unsaved indicator, settings access

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process                 │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐│
│  │  IPC      │  │ node-pty │  │   Express Backend      ││
│  │ Handlers  │  │ Terminal │  │  ┌──────────────────┐  ││
│  │(fs,app,  │  │  Spawner │  │  │  /api/ai/chat    │  ││
│  │ git)     │  └──────────┘  │  │  /api/ai/agent   │  ││
│  └──────────┘                │  │  /api/ai/complete │  ││
│                               │  │  /api/ai/models  │  ││
│                               │  │  /api/rag/*      │  ││
│                               │  └──────────────────┘  ││
│                               └────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│                   Preload (contextBridge)                │
│         window.nexusAPI (fs, app, terminal, git, search) │
├─────────────────────────────────────────────────────────┤
│                    Renderer (React 18)                   │
│  ┌──────┐ ┌──────────┐ ┌────────┐ ┌──────┐ ┌────────┐ │
│  │Active│ │FileTree/ │ │ Monaco │ │ AI   │ │Terminal│ │
│  │ Bar  │ │Search/   │ │ Editor │ │ Panel│ │ Panel  │ │
│  │      │ │Git/Debug │ │+Inline │ │ +RAG │ │        │ │
│  └──────┘ └──────────┘ └────────┘ └──────┘ └────────┘ │
│                    Zustand State Management              │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Desktop Framework** | Electron 29 + electron-vite 2 |
| **Frontend** | React 18 + TypeScript 5.3 |
| **Editor Engine** | Monaco Editor 0.45 (locally bundled) |
| **State Management** | Zustand 4.5 (persisted) |
| **Styling** | Tailwind CSS 3.4 |
| **Terminal** | xterm.js 5.5 + node-pty |
| **AI SDKs** | OpenAI SDK, Anthropic SDK |
| **Backend** | Express 4.18 (in-process) |
| **Database** | better-sqlite3 (planned) |
| **Build** | electron-builder |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+
- **npm** 9+
- **Windows Build Tools** (for native modules): `npm install -g windows-build-tools`

### Installation

```bash
# Clone the repository
git clone https://github.com/farukselcuk/Zyrex.git
cd Zyrex

# Install dependencies
npm install

# Rebuild native modules for Electron (node-pty, better-sqlite3)
npm run rebuild

# Start in development mode
npm run dev
```

### Build for Production

```bash
# Build the app
npm run build

# Package as distributable
npm run package
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Toggle File Explorer |
| `Ctrl+Shift+F` | Toggle Search Panel |
| `Ctrl+Shift+A` | Toggle AI Panel |
| `Ctrl+`` ` | Toggle Terminal |
| `Ctrl+N` | New File |
| `Ctrl+O` | Open File |
| `Ctrl+S` | Save File |
| `Ctrl+Shift+F` | Format Document (in editor) |

---

## 📂 Project Structure

```
Zyrex/
├── electron/
│   ├── main.ts              # Electron main process, IPC handlers
│   ├── preload.ts           # contextBridge (nexusAPI)
│   └── backend/
│       ├── ai.ts            # AI routes (chat, agent, complete, models)
│       ├── rag.ts           # TF-IDF RAG context engine
│       ├── db.ts            # SQLite layer (planned)
│       └── server.ts        # Express server
├── src/
│   ├── App.tsx              # Root layout with activity bar
│   ├── main.tsx             # React entry point
│   ├── monacoSetup.ts       # Local Monaco bundling config
│   ├── index.css            # Tailwind + custom theme
│   ├── components/
│   │   ├── TitleBar.tsx
│   │   ├── StatusBar.tsx
│   │   ├── AIPanel/         # AI chat with streaming
│   │   ├── Editor/
│   │   │   ├── EditorArea.tsx
│   │   │   ├── MonacoWrapper.tsx  # Model-cached editor + snippets
│   │   │   ├── TabBar.tsx
│   │   │   ├── Breadcrumb.tsx     # Path breadcrumb navigation
│   │   │   ├── DiffView.tsx      # Monaco diff editor
│   │   │   └── inlineCompletions.ts  # AI ghost text provider
│   │   ├── FileTree/        # File explorer with drag-drop
│   │   ├── GitPanel/        # Git source control
│   │   ├── DebugPanel/      # Debug with breakpoints
│   │   ├── ModelSelector/   # LLM model picker
│   │   ├── SearchPanel/     # Project-wide search
│   │   ├── Settings/        # API keys & AI config
│   │   └── Terminal/        # xterm.js terminal
│   ├── store/
│   │   └── index.ts         # Zustand stores
│   └── types/
│       └── index.ts         # TypeScript interfaces
├── package.json
├── electron-builder.yml
├── electron.vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## 🗺️ Roadmap

- [x] Monaco Editor with full integration
- [x] File Tree with drag-drop, rename, context menu
- [x] AI Chat with multi-LLM streaming
- [x] Agentic AI tools (readFile, writeFile, runCommand)
- [x] Integrated terminal (xterm.js + node-pty)
- [x] Diff view for AI changes
- [x] Project-wide search
- [x] Settings panel for API keys
- [x] Git integration (status, stage, commit, push, pull, branches, log)
- [x] Inline AI completions (ghost text)
- [x] RAG Context Engine — TF-IDF codebase indexing
- [x] Breadcrumb navigation
- [x] Multi-cursor & built-in snippets
- [x] Debug integration (breakpoints, variables, call stack)
- [ ] Tree-sitter AST analysis
- [ ] LSP integration for external language servers
- [ ] Plugin/extension system
- [ ] Collaborative editing

---

## 📄 License

This project is proprietary software. All rights reserved.

---

<div align="center">

**Built with ❤️ by [Faruk Selçuk](https://github.com/farukselcuk)**

</div>
