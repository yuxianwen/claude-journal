# Claude Journal

A local web app for browsing and reviewing your Claude Code conversation history. Reads JSONL session files directly from `~/.claude/projects/` — no configuration required.

**Language:** [简体中文](README.md) | English | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português](README.pt.md) | [Русский](README.ru.md) | [العربية](README.ar.md) | [हिन्दी](README.hi.md)

![Main UI](public/screenshot-main.png)

## Features

- **Project & Session Browser** — All projects grouped by working directory, with full session history in the sidebar
- **Conversation Rendering** — Full Markdown rendering, syntax-highlighted code blocks (Shiki), GFM tables & task lists
- **Tool Call Visualization** — See every tool call Claude made (Bash, file reads/writes, etc.) and its output
- **Thinking Blocks** — Collapsible display of Claude's reasoning process
- **Token Stats** — Input / output / cache-hit token counts and estimated cost per session
- **Full-text Search** — `⌘K` to search across all sessions instantly
- **Export to Markdown** — Copy any conversation as Markdown with one click

![Search UI](public/screenshot-search.png)

## Quick Start

**Prerequisites:** [Claude Code](https://claude.ai/code) must be installed and have been used at least once, so `~/.claude/projects/` exists locally.

```bash
# Clone the repo
git clone https://github.com/yuxianwen/claude-journal.git
cd claude-journal

# Install dependencies
pnpm install

# Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to browse all your Claude Code sessions.

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16 | Framework & API Routes |
| React | 19 | UI |
| Tailwind CSS | v4 | Styling |
| Shiki | v4 | Code syntax highlighting |
| react-markdown | v10 | Markdown rendering |
| remark-gfm | v4 | GFM extended syntax |

## Data Source

The app reads local files only — no network requests, no data uploaded. Session data path:

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
