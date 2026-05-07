# Claude Journal

用于浏览和回顾 Claude Code 对话历史的 PWA。完全在浏览器中运行，通过 File System Access API 直接读取本地 `~/.claude/projects/` 文件。无需服务器，不上传任何数据。

**在线地址：** [https://claude-journa.yuxianwen.dpdns.org](https://claude-journa.yuxianwen.dpdns.org)

**语言：** 简体中文 | [English](README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português](README.pt.md) | [Русский](README.ru.md) | [العربية](README.ar.md) | [हिन्दी](README.hi.md)

![主界面](public/screenshot-main.png)

## 功能

- **项目 & 会话浏览** — 按工作目录分组，侧边栏展示所有项目和历史会话
- **对话渲染** — Markdown 全渲染，代码块语法高亮（Shiki），支持 GFM 表格 / 任务列表
- **工具调用展示** — 可视化 Claude 执行的每次工具调用（Bash、文件读写等）及其输出
- **Thinking 块** — 折叠展示 Claude 的推理过程
- **Token 统计** — 每次会话的输入 / 输出 / 缓存命中 token 数，以及估算费用
- **全文搜索** — `⌘K` 跨所有会话实时搜索
- **导出 Markdown** — 一键将对话复制为 Markdown 格式
- **PWA** — 可安装到桌面或主屏幕，体验接近原生应用

![搜索界面](public/screenshot-search.png)

## 使用方法

### 方式一 — 直接使用在线版（推荐）

打开 [https://claude-journa.yuxianwen.dpdns.org](https://claude-journa.yuxianwen.dpdns.org)，点击 **"选择文件夹"** 授权访问 `~/.claude/projects/` 目录。浏览器直接从本机读取文件，不会上传任何内容。

文件夹选择会保存在本地（IndexedDB），下次访问自动加载。

> **浏览器支持：** Chrome、Edge、Safari（macOS）。Firefox 不支持（无 File System Access API）。

### 方式二 — 本地运行

```bash
git clone https://github.com/yuxianwen/claude-journal.git
cd claude-journal
pnpm install
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16 | 框架（静态导出） |
| React | 19 | UI |
| Tailwind CSS | v4 | 样式 |
| Shiki | v4 | 代码语法高亮 |
| react-markdown | v10 | Markdown 渲染 |
| remark-gfm | v4 | GFM 扩展语法 |
| File System Access API | — | 浏览器原生本地文件读取 |

## 数据来源

所有数据留在你的本机。应用通过浏览器的 [File System Access API](https://developer.mozilla.org/zh-CN/docs/Web/API/File_System_Access_API) 直接读取会话文件，不发出任何网络请求，不上传数据。

```
~/.claude/projects/
  └── <project-id>/
        ├── <session-id>.jsonl
        └── ...
```

每个 `.jsonl` 文件对应一次 Claude Code 会话，包含完整的消息记录和 token 用量。

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `⌘K` | 打开全文搜索 |
| `Esc` | 关闭搜索 |
