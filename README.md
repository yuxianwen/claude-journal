# Claude Journal

本地 Web 应用，用于浏览和回顾你的 Claude Code 对话历史。直接读取 `~/.claude/projects/` 中的 JSONL 会话文件，无需任何配置。

![主界面](public/screenshot-main.png)

## 功能

- **项目 & 会话浏览** — 按工作目录分组，侧边栏展示所有项目和历史会话
- **对话渲染** — Markdown 全渲染，代码块语法高亮（Shiki），支持 GFM 表格 / 任务列表
- **工具调用展示** — 可视化 Claude 执行的每次工具调用（Bash、文件读写等）及其输出
- **Thinking 块** — 折叠展示 Claude 的推理过程
- **Token 统计** — 每次会话的输入 / 输出 / 缓存命中 token 数，以及估算费用
- **全文搜索** — `⌘K` 跨所有会话实时搜索
- **导出 Markdown** — 一键将对话复制为 Markdown 格式

![搜索界面](public/screenshot-search.png)

## 快速开始

**前置条件：** 已安装并使用过 [Claude Code](https://claude.ai/code)，本地存在 `~/.claude/projects/` 目录。

```bash
# 克隆项目
git clone https://github.com/yuxianwen/claude-journal.git
cd claude-journal

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可看到你的所有 Claude Code 会话。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16 | 框架 & API Routes |
| React | 19 | UI |
| Tailwind CSS | v4 | 样式 |
| Shiki | v4 | 代码语法高亮 |
| react-markdown | v10 | Markdown 渲染 |
| remark-gfm | v4 | GFM 扩展语法 |

## 数据来源

应用只读取本地文件，不联网，不上传任何数据。会话数据路径：

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
