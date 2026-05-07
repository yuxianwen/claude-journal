# Claude Journal

A PWA for browsing and reviewing your Claude Code conversation history. Runs entirely in the browser — reads your local `~/.claude/projects/` files directly via the File System Access API. No server, no data uploaded.

**Live Demo:** [https://claude-journa.yuxianwen.dpdns.org](https://claude-journa.yuxianwen.dpdns.org)

**Language:** [简体中文](README.zh-CN.md) | English | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português](README.pt.md) | [Русский](README.ru.md) | [العربية](README.ar.md) | [हिन्दी](README.hi.md)

![Main UI](public/screenshot-main.png)

## Features

- **Project & Session Browser** — All projects grouped by working directory, with full session history in the sidebar
- **Conversation Rendering** — Full Markdown rendering, syntax-highlighted code blocks (Shiki), GFM tables & task lists
- **Tool Call Visualization** — See every tool call Claude made (Bash, file reads/writes, etc.) and its output
- **Thinking Blocks** — Collapsible display of Claude's reasoning process
- **Token Stats** — Input / output / cache-hit token counts and estimated cost per session
- **Full-text Search** — `⌘K` to search across all sessions instantly
- **Export to Markdown** — Copy any conversation as Markdown with one click
- **PWA** — Install to your desktop or home screen for a native app experience

![Search UI](public/screenshot-search.png)

## Usage

### Option 1 — Use Online (Recommended)

Open [https://claude-journa.yuxianwen.dpdns.org](https://claude-journa.yuxianwen.dpdns.org) and click **"选择文件夹"** to grant access to your `~/.claude/projects/` folder. The browser reads files directly from your machine — nothing is uploaded.

Your folder selection is persisted locally (IndexedDB), so subsequent visits load automatically.

> **Browser support:** Chrome, Edge, Safari (macOS). Firefox is not supported (no File System Access API).

### Option 2 — Run Locally

```bash
git clone https://github.com/yuxianwen/claude-journal.git
cd claude-journal
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16 | Framework (static export) |
| React | 19 | UI |
| Tailwind CSS | v4 | Styling |
| Shiki | v4 | Code syntax highlighting |
| react-markdown | v10 | Markdown rendering |
| remark-gfm | v4 | GFM extended syntax |
| File System Access API | — | Browser-native local file reading |

## Data Source

All data stays on your machine. The app uses the browser's [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) to read session files directly — no network requests, no uploads.

```
~/.claude/projects/
  └── <project-id>/
        ├── <session-id>.jsonl
        └── ...
```

Each `.jsonl` file corresponds to one Claude Code session and contains the full message history along with token usage.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` | Open full-text search |
| `Esc` | Close search |
