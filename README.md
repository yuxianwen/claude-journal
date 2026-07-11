# AI Journal

A PWA for browsing and reviewing Claude Code and Codex conversation history. Runs entirely in the browser for remote use — reads local files directly via the File System Access API. No server, no data uploaded.

**Live Demo:** [https://claude-journa.yuxianwen.dpdns.org](https://claude-journa.yuxianwen.dpdns.org)

**Language:** [简体中文](README.zh-CN.md) | English | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português](README.pt.md) | [Русский](README.ru.md) | [العربية](README.ar.md) | [हिन्दी](README.hi.md)

![Main UI](public/screenshot-main.png)

## Features

- **Project & Session Browser** — All projects grouped by working directory, with full session history in the sidebar
- **Sidebar Filter** — Type a keyword to instantly filter projects and sessions; match count updates in real time
- **Conversation Rendering** — Full Markdown rendering, syntax-highlighted code blocks (Shiki), GFM tables & task lists
- **Privacy-aware Images** — Embedded images render locally; external URLs stay blocked until you choose to load them
- **Image Lightbox** — Full-screen overlay with backdrop blur; close with `Esc` or by clicking outside
- **Claude / Codex Sources** — Switch between Claude Code history and Codex history from the sidebar
- **Tool Call Visualization** — See every tool call made by the assistant (Bash, file reads/writes, screenshots, etc.) and its output, including inline image results
- **Thinking Blocks** — Collapsible display of reasoning content when available
- **Slash Command Display** — `/command` messages render as styled chips instead of raw XML
- **Local Command Output** — Shell command output blocks display as terminal-style UI; verbose caveats are collapsible
- **Token Stats** — Input / output / cache-hit token counts per session
- **Incremental Full-text Search** — `⌘K` searches a persistent local index that only rebuilds changed sessions
- **Session Digest** — Evidence-linked goals, outcomes, changed files, commands, failures, and commits
- **Favorites, Tags & Notes** — Keep private annotations per session and filter the sidebar to favorites
- **Lossless Markdown / Image Export** — Export full text and tool results, or copy a message as an image
- **Theme Switcher** — Light, dark, or system theme with persistent preference
- **Persistent Filter Bar** — Filter settings (thinking, tools, user/assistant messages) survive session switches
- **Session Memory** — Last-viewed conversation is restored on refresh via URL parameters
- **Bookmark URLs** — Copy the URL to reopen an exact conversation and scroll position on the same browser and machine (`?p=&s=&scroll=`). The URL contains no session data and does not grant another person access to your local files.
- **Back to Top** — Floating button appears when scrolled far down; one click returns to the top
- **11-language UI** — Auto-detects browser locale; switch at any time via the language picker
- **PWA** — Install to your desktop or home screen; auto-updates silently when a new version is deployed

![Search UI](public/screenshot-search.png)

## Usage

### Option 1 — Use Online (Recommended)

Open [https://claude-journa.yuxianwen.dpdns.org](https://claude-journa.yuxianwen.dpdns.org), choose **Claude** or **Codex**, then click **"选择文件夹"**. Select `~/.claude/projects/` for Claude Code or `~/.codex/sessions/` for Codex. The browser reads files directly from your machine — nothing is uploaded.

Your folder selection is persisted locally (IndexedDB), so subsequent visits load automatically.

> **Browser support for the hosted app:** Desktop Chrome and Edge, which implement `showDirectoryPicker()`. Safari and Firefox cannot currently select the local history directory. Local mode uses the app's API routes and does not require this browser API.

### Option 2 — Run Locally

```bash
git clone https://github.com/yuxianwen/claude-journal.git
cd claude-journal
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Local mode can read `~/.claude/projects/` and `~/.codex/sessions/` through the app's API routes.

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

Session contents are read and processed on your machine with the browser's [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API); AI Journal does not upload them and includes no analytics. Loading the hosted app and update checks still make ordinary network requests. Externally referenced images remain blocked until you explicitly choose to load them.

Claude Code:

```txt
~/.claude/projects/
  └── <project-id>/
        ├── <session-id>.jsonl
        └── ...
```

Codex:

```txt
~/.codex/sessions/
  └── YYYY/MM/DD/
        ├── rollout-<timestamp>-<id>.jsonl
        └── ...
```

Each `.jsonl` file corresponds to one session and contains message history plus available token usage.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` | Open full-text search |
| `⌘\` | Toggle sidebar |
| `Esc` | Close search / lightbox |
