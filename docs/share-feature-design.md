# 对话分享功能 — 方案设计

> 状态：设计草案，未开工。目标是把某个会话发布成一个别人能在浏览器里打开的公开页面。

## 1. 背景与约束

当前架构（务必先理解，它决定了方案空间）：

- **纯静态导出**：`next.config.ts` 在 Vercel 上强制 `output: "export"`；`vercel.json` 构建命令 `rm -rf src/app/api && next build` 会删掉所有 API 路由。**线上没有任何服务端。**
- **隐私招牌**：README / 应用内反复强调 "No server, no data uploaded"、无 analytics。会话数据只经浏览器 File System Access API 读取，从不离开机器。
- **数据模型**：`ConversationData = { session: SessionMeta, messages: Message[] }`（见 `src/types/index.ts`）。
- **渲染组件依赖**：`MessageBubble` / `ToolCallBlock` / `PrivacyImage` 只依赖 `useI18n` + `useSettings`，**不依赖 `FolderContext`**。`layout.tsx` 里四个 Provider 包裹全部路由 → 新增 `/share` 路由可直接复用 i18n / 主题 / 设置。
- **浏览器**：宿主应用已经只支持 Chrome/Edge（`showDirectoryPicker`）。但"查看被分享的对话"这一侧应尽量兼容更多浏览器。

"分享到互联网" 的本质：把会话内容送到一个陌生人浏览器能加载的公开 URL。只有三种途径 —— 塞进 URL、加后端存储、导出成文件自己托管。

## 2. 关键横切设计（三条路线共用）

### 2.1 分享载荷 `SharePayload`

新文件 `src/lib/share-types.ts`：

```ts
export const SHARE_SCHEMA_VERSION = 1;

export interface SharePayload {
  v: number;                    // schema 版本
  session: {
    title: string;
    provider: Provider;
    model?: string;
    startTime?: string;
    endTime?: string;
    cwd?: string;               // 默认打码为 "~/…/<basename>"
  };
  messages: Message[];          // 已按 filters 过滤、已打码
  filters: MessageFilters;      // 生成时应用的过滤
  redactions: {
    paths: number;
    secrets: number;
    imagesStripped: number;
  };
  createdAt: string;
}
```

### 2.2 打码 `src/lib/share-redact.ts`（+ 测试）—— 最重要的部分

Claude Code / Codex 的 transcript 常含：密钥、含用户名的绝对路径、私有代码、`.env` 内容、命令输出里的 token。**分享功能绝不能一键公开原文。**

默认开启的清洗器（作用于 `SharePayload`，遍历所有 text / tool_use.input / tool_result.content）：

- **路径**：`/Users/<name>`、`/home/<name>`、`C:\Users\<name>` → `~`；其它绝对路径按需保留。
- **密钥模式**：`sk-…`、`ghp_…` / `github_pat_…`、`AKIA[0-9A-Z]{16}`、`xox[baprs]-…`、JWT（`eyJ…\.…\.…`）、`-----BEGIN … PRIVATE KEY-----`、`Authorization: Bearer …`、`API_KEY=…` / `SECRET=…` / `TOKEN=…`、疑似密钥的长 hex/base64 串。
- **环境变量**：`.env` 文件读取、`printenv` / `env` 命令输出 → 值打码为 `••••`。

匹配到就替换为 `[REDACTED:secret]` / `[REDACTED:path]` 并计数。

**发布前预览 UI**（在分享弹窗里）：渲染即将分享的内容，高亮所有打码点，允许逐条还原、也允许手动选中文本追加打码。顶部显示 "已屏蔽 12 处疑似密钥 / 5 处路径"。弹窗必须明确写：打码是尽力而为，不保证零泄漏，用户对分享内容负责。

### 2.3 过滤与体积

- 分享弹窗复用现有 `MessageFilters`。分享默认值：`thinking` 关、`tools` 开、图片剥离（可勾选保留）。
- 图片：`image` 块的 base64（`source.data`）和 tool_result 里的内嵌图片体积极大。默认替换为占位符 `[图片已移除]`，计入 `redactions.imagesStripped`。
- 实时显示预计产出体积。

### 2.4 只读渲染器 `src/components/SharedConversationView.tsx`

从 `ConversationView` 抽出纯渲染部分，去掉：轮询、滚动持久化、FolderContext、标注、可编辑标题、翻译按钮（`translate.ts` 是外部 API，被分享方不应触发）。

输入：`SharePayload`。复用 `MessageBubble` + `collectToolResults` + `StatsBar` + `SessionSummaryCard`。头部加 "共享的对话" 徽标 + 回主应用链接。`PrivacyImage` 的外链拦截照常生效。

路线 B 和路线 C 都用它。

## 3. 三条路线

### 路线 A — 自包含 HTML 导出（零后端）

`src/lib/share-html.ts`：`buildShareHtml(payload): string` 生成单个 HTML 文件：

- 内嵌一份 ~3KB 的手写样式（GitHub-markdown 风格），不依赖 Tailwind。
- 生成时把 `conversationToMarkdown()`（已存在、无损、不含 base64）转成 HTML 字符串写入 —— 需要引入一个小 markdown 库（如 `marked`，~30KB）在浏览器里转换；代码高亮用 `<pre>` 或 CDN highlight.js。
- 用户在分享弹窗点 "导出为网页" → 下载 `conversation-<title>.html` → 自行丢到 GitHub Pages / gist / 自己域名。

| 优 | 劣 |
|---|---|
| 零基础设施、零隐私模型改动、可离线 | 要自己托管、没有短链、样式与主应用有差异 |

工作量：中。主要是独立渲染器 + 样式。

### 路线 B — URL 内嵌链接（零后端）

新路由 `src/app/share/page.tsx`（client component，静态导出兼容）。

**生成**（在 `ConversationView` 里）：

1. 由 `data` + `filters` 构建 `SharePayload`，跑打码。
2. `JSON.stringify` → `TextEncoder` → `CompressionStream('gzip')` → base64url。
3. 链接 = `${origin}/share#d=<base64url>`。用 **hash 不用 query**：不进服务端日志 / referer，静态宿主直接忽略。
4. 复制到剪贴板。压缩后 > ~40KB 时提示 "对话较大，部分聊天软件可能截断链接，建议改用网页导出"。

**查看** `/share`：

- 读 `location.hash` → 去掉 `#d=` → base64url decode → `DecompressionStream('gzip')` → JSON → 校验 `v === SHARE_SCHEMA_VERSION`。
- 交给 `SharedConversationView` 渲染。

**体积可行性**：JSONL transcript 高度重复，gzip 约 5–10x。200KB transcript → ~25KB → base64 ~34KB，能塞下。2MB transcript → ~250KB，塞不下 → 引导用户走路线 A。过滤（关 tools/thinking 砍掉 70%+）和剥图是关键。

**浏览器支持**：`CompressionStream` —— Chrome/Edge、Safari 16.4+、Firefox 113+。生成侧本来就 Chrome/Edge。查看侧对不支持的浏览器提供无压缩回退（直接 base64url(JSON)，更大但能用）。

| 优 | 劣 |
|---|---|
| 无后端、即时出链接、部署在现有站点、收件方零依赖 | URL 长度上限、无链接预览图、URL 又长又丑、有链接即见全部内容 |

工作量：中。路由 + 编解码 + 只读渲染器 + 打码 UI。

### 路线 C — 后端 + 对象存储

架构性改动。

**让 Vercel 上有服务端**：

- 放弃 `output: "export"`，整个 app 改成常规 Next.js（Fluid Compute）。客户端逻辑不受影响；`src/app/api/*`（目前仅本地开发用，读 `~/.claude`）需用环境变量在线上禁用，只保留 share 端点。
- `vercel.json` 的 `rm -rf src/app/api` 去掉，改为更精细的构建。

**存储**：Vercel Blob 公共存储最合适（`put(\`${id}.json\`, body, { access: 'public' })`）。**必须走 `marketplace` skill provision，不能硬编码 SDK。** 或选 marketplace 里的 KV / Postgres。

**端点**：

- `POST /api/share` —— body = 客户端已打码的 `SharePayload`。校验体积（< 5MB）、生成 `nanoid`、存 `{ payload, createdAt, expiresAt }`。返回 `{ id, url }`。可选：返回一个 delete token（存创建者 localStorage，用于"取消分享"）；可选口令（存 argon2 hash）。
- `GET /share/<id>` —— **server component** 拉取 Blob 并 SSR → 真正的 OG 标签 + `opengraph-image.tsx` 生成预览卡片。复用只读渲染器的 server-safe 变体。
- `DELETE /api/share/<id>` —— 带 delete token。

**解锁**：短链、社交预览图、过期时间（读时校验 + cron 清扫）、浏览计数、口令保护、"我分享过的对话" 管理页。

**代价**：

- Blob 存储 + 函数调用费用（很小）。
- 变成一个长期运行的服务，有滥用面 —— 需要限流（Vercel Firewall / BotID）、体积上限、也许要登录。
- **隐私招牌被打破**："不上传数据" 变成 "每次分享显式上传"。README / 应用内文案 / 隐私章节都要重写，分享前要有明确的知情同意弹窗。

工作量：大。基础设施 + 端点 + SSR 渲染器 + OG + 滥用防护 + 文档重写。

## 4. 建议：分阶段

| 阶段 | 内容 | 产出 |
|---|---|---|
| **P1**（已实现） | 打码库 `share-redact` + `SharePayload` 类型 + 分享弹窗 `ShareDialog` + **路线 A**（HTML 导出） | 立刻可用、零基础设施、零隐私回退。打码库和弹窗是后续基础。 |
| **P2** | **路线 B**（URL 链接）：复用 P1 的弹窗 + 打码 + 新建只读渲染器 `SharedConversationView` + `/share` 路由 | 覆盖 "给我个链接" 的常见体积场景。 |
| **P3** | **路线 C**：仅当需要短链 / 预览图 / 超大对话 / 做成正式产品功能时。需架构 + 文档改动，单独决策后再上。 | P2 建的只读渲染器被 P3 的 SSR 复用。 |

## 5. 文件级改动清单

**新增**

- `src/lib/share-types.ts` —— `SharePayload`、`SHARE_SCHEMA_VERSION`
- `src/lib/share-redact.ts` (+ `.test.ts`) —— 清洗器
- `src/lib/share-codec.ts` (+ `.test.ts`) —— 构建载荷 / gzip+base64url 编解码 / 体积估算
- `src/lib/share-html.ts` (+ `.test.ts`) —— 路线 A 的独立 HTML 生成
- `src/components/ShareDialog.tsx` —— 过滤 + 打码预览 + 产出方式选择 + 复制/下载
- `src/components/SharedConversationView.tsx` —— 只读渲染器（路线 B/C）
- `src/app/share/page.tsx` —— hash 解码 + `SharedConversationView`（路线 B）
- **P3**：`src/app/api/share/route.ts`、`src/app/share/[id]/page.tsx`、`src/app/share/[id]/opengraph-image.tsx`、存储接线、`next.config.ts` / `vercel.json` 改动

**修改**

- `src/components/ConversationView.tsx` —— 在 `CopyButton` 旁加 "分享" 按钮，打开 `ShareDialog`
- `src/components/MessageBubble.tsx` —— 确认无 `FolderContext` 依赖后即可直接复用（当前看只依赖 `useI18n` / `useSettings`，OK）
- `src/i18n/locales.ts` —— 新增文案键（11 种语言）
- `README*.md` —— 记录分享功能；**P3 还需重写隐私章节**

## 6. 风险 / 待决策

- `CompressionStream` 在查看侧的浏览器覆盖 —— 需无压缩回退。
- 打码永远是尽力而为，不能保证无泄漏 —— 弹窗必须声明，责任在用户。
- 路线 C 改变项目的核心隐私主张 —— 需要产品层面明确拍板。
- 翻译按钮在被分享视图里要去掉（外部 API）。
- `share-html.ts` 需要新增一个 markdown 渲染依赖（`marked` 之类）。
