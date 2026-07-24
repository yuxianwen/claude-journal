# AI Journal

用于浏览和回顾 Claude Code、Codex 以及 Antigravity (Gemini) 对话历史的 PWA。远程使用时完全在浏览器中运行，通过 File System Access API 直接读取本地文件。无需服务器，不上传任何数据。

**在线地址：** [https://claude-journa.yuxianwen.dpdns.org](https://claude-journa.yuxianwen.dpdns.org)

**语言：** 简体中文 | [English](README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português](README.pt.md) | [Русский](README.ru.md) | [العربية](README.ar.md) | [हिन्दी](README.hi.md)

![主界面](public/screenshot-main.png)

## 功能

- **项目 & 会话浏览** — 按工作目录分组，侧边栏展示所有项目和历史会话
- **侧边栏快速筛选** — 输入关键字即时过滤项目和会话，匹配数量实时更新
- **对话渲染** — Markdown 全渲染，代码块语法高亮（Shiki），支持 GFM 表格 / 任务列表
- **隐私图片加载** — 内嵌图片在本地显示；外链图片只有经你点击确认后才会请求
- **图片灯箱** — 全屏遮罩层，带背景模糊效果；按 `Esc` 或点击背景关闭
- **多端智能体支持** — 在左下角的全局设置菜单中可一键切换 Claude Code、Codex 与 Antigravity (Gemini CLI) 历史
- **消息一键翻译** — 一键将大模型输出的外语或用户提问翻译为你偏好的本地语言
- **全局首选项面板** — 一站式管理数据源、界面语言、翻译目标语言和主题外观（快捷键 `Cmd+,` 打开）
- **工具调用展示** — 可视化助手执行的每次工具调用（Bash、文件读写、截图等）及其输出，包含内联图片结果
- **Thinking 块** — 折叠展示 助手的推理过程
- **斜杠命令显示** — `/command` 消息渲染为样式化标签，不再是原始 XML
- **本地命令输出** — Shell 命令输出块以终端样式展示；详细提示信息可折叠
- **Token 统计** — 每次会话的输入 / 输出 / 缓存命中 token 数
- **增量全文搜索** — `⌘K` 查询持久化本地索引，只重建发生变化的会话
- **会话摘要** — 从原始证据提取目标、结果、改动文件、命令、失败和 commit
- **收藏、标签与笔记** — 为会话保存私人注释，并在侧边栏只看收藏
- **无损 Markdown / 图片导出** — 完整导出正文和工具结果，或将单条消息复制为图片
- **主题切换** — 亮色 / 暗色 / 跟随系统，偏好持久保存
- **筛选栏持久化** — 筛选设置（思考、工具、用户/助手消息）在切换会话时保持不变
- **会话记忆** — 刷新后通过 URL 参数恢复上次浏览的会话
- **书签 URL** — 复制网址后，可在同一浏览器和电脑上重新打开精确的会话与滚动位置（`?p=&s=&scroll=`）。URL 不包含会话数据，也不会授权他人访问你的本地文件。
- **回到顶部** — 向下滚动较多时出现悬浮按钮，一键返回顶部
- **11 种语言界面** — 自动检测浏览器语言，随时切换
- **PWA** — 可安装到桌面或主屏幕；部署新版本时自动静默更新

![搜索界面](public/screenshot-search.png)

## 使用方法

### 方式一 — 直接使用在线版（推荐）

打开 [https://claude-journa.yuxianwen.dpdns.org](https://claude-journa.yuxianwen.dpdns.org)，通过 `Cmd+,` 打开设置，先选择 **Claude**、**Codex** 或者是 **Antigravity** 数据源，再点击 **"选择文件夹"**。Claude Code 选择 `~/.claude/projects/`，Codex 选择 `~/.codex/sessions/`，Antigravity 选择 `~/.gemini/antigravity-cli/brain/`。浏览器直接从本机读取文件，不会上传任何内容。

文件夹选择会保存在本地（IndexedDB），下次访问自动加载。

> **在线版浏览器支持：** 支持 `showDirectoryPicker()` 的桌面版 Chrome 和 Edge。Safari 与 Firefox 目前无法选择本地历史目录。本地运行模式通过应用 API 路由读取，不依赖该浏览器 API。

### 方式二 — 本地运行

```bash
git clone https://github.com/yuxianwen/claude-journal.git
cd claude-journal
pnpm install
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可。本地模式下应用会自动通过 API 路由读取本地 `~/.claude/projects/`、`~/.codex/sessions/` 和 `~/.gemini/` 等相关目录，无需手动选择文件夹。

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

会话内容通过浏览器的 [File System Access API](https://developer.mozilla.org/zh-CN/docs/Web/API/File_System_Access_API) 在本机读取和处理；AI Journal 不会上传这些内容，也不包含分析统计。加载在线应用和检查更新仍会产生常规网络请求；会话中的外链图片默认阻止，只有你明确点击后才会加载。

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

每个 `.jsonl` 文件对应一次会话，包含消息记录和可用的 token 用量。

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `⌘K` | 打开全文搜索 |
| `⌘\` | 展开 / 收起侧边栏 |
| `Esc` | 关闭搜索 / 灯箱 |
