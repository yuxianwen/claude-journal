import { Marked } from 'marked';
import type { ContentBlock } from '@/types';
import type { SharePayload } from './share-types';

export interface BuildShareHtmlOptions {
  assistantName: string;
  userLabel: string;
}

/**
 * Escape HTML special characters in plain text strings.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeBasicEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#([0-9]+);?/gi, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

/**
 * Validate that a URL is safe to embed in an href or src attribute.
 * Disallows javascript:, data:, vbscript:, etc.
 */
export function isSafeUrl(url: string): boolean {
  if (!url) return false;
  const decoded = decodeBasicEntities(url);
  const clean = decoded.replace(/[\x00-\x20\s]+/g, '').toLowerCase();
  if (
    clean.startsWith('javascript:') ||
    clean.startsWith('vbscript:') ||
    clean.startsWith('data:')
  ) {
    return false;
  }
  return true;
}

/**
 * Custom Marked instance that renders raw/inline HTML as escaped visible text
 * and strips unsafe URL protocols (e.g. javascript:, data:) from links and images.
 */
const safeMarked = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
    link({ href, title, tokens }) {
      const cleanHref = (href || '').trim();
      if (!isSafeUrl(cleanHref)) {
        return this.parser.parseInline(tokens);
      }
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      const inner = this.parser.parseInline(tokens);
      return `<a href="${escapeHtml(cleanHref)}"${titleAttr} rel="noopener noreferrer">${inner}</a>`;
    },
    image({ href, title, text }) {
      const cleanHref = (href || '').trim();
      if (!isSafeUrl(cleanHref)) {
        return escapeHtml(text || '');
      }
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      const altAttr = text ? ` alt="${escapeHtml(text)}"` : '';
      return `<img src="${escapeHtml(cleanHref)}"${altAttr}${titleAttr} loading="lazy" />`;
    },
  },
});

/**
 * Convert markdown text to safe HTML.
 */
function renderMarkdown(text: string): string {
  try {
    return safeMarked.parse(text, { async: false }) as string;
  } catch {
    return `<p>${escapeHtml(text)}</p>`;
  }
}

/**
 * Format tool_result content (string or ContentBlock[]) to a text string.
 */
function formatToolResultContent(content: string | ContentBlock[]): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content);

  const parts: string[] = [];
  for (const block of content) {
    if (block.type === 'text') {
      parts.push(block.text);
    } else if (block.type === 'thinking') {
      parts.push(block.thinking);
    } else if (block.type === 'tool_use') {
      parts.push(`Tool: ${block.name}\n${JSON.stringify(block.input, null, 2)}`);
    } else if (block.type === 'tool_result') {
      parts.push(`Tool Result (${block.tool_use_id}):\n${formatToolResultContent(block.content)}`);
    } else if (block.type === 'image') {
      parts.push('[Image]');
    }
  }
  return parts.join('\n');
}

/**
 * Render a single ContentBlock into an HTML fragment.
 */
function renderBlockHtml(block: ContentBlock): string {
  switch (block.type) {
    case 'text':
      return `<div class="markdown-body">${renderMarkdown(block.text)}</div>`;

    case 'thinking':
      return `
<details class="thinking-block">
  <summary class="thinking-summary">Thinking</summary>
  <div class="thinking-content markdown-body">${renderMarkdown(block.thinking)}</div>
</details>`;

    case 'tool_use':
      return `
<div class="tool-box tool-use">
  <div class="tool-header">
    <span class="tool-badge">🔧 Tool Call</span>
    <code class="tool-name">${escapeHtml(block.name)}</code>
  </div>
  <pre class="tool-pre"><code>${escapeHtml(JSON.stringify(block.input, null, 2))}</code></pre>
</div>`;

    case 'tool_result':
      return `
<div class="tool-box tool-result">
  <div class="tool-header">
    <span class="tool-badge">📋 Tool Result</span>
    <code class="tool-name">${escapeHtml(block.tool_use_id)}</code>
  </div>
  <pre class="tool-pre"><code>${escapeHtml(formatToolResultContent(block.content))}</code></pre>
</div>`;

    case 'image':
      if (block.source.data) {
        const mediaType = (block.source.media_type || 'image/png').trim();
        const safeMediaType = /^image\/(?:png|jpeg|jpg|webp|gif)$/i.test(mediaType) ? mediaType : 'image/png';
        return `<div class="image-box"><img src="data:${escapeHtml(safeMediaType)};base64,${escapeHtml(block.source.data)}" alt="Conversation Image" class="shared-image" loading="lazy" /></div>`;
      }
      if (block.source.url && isSafeUrl(block.source.url)) {
        return `<div class="image-box"><img src="${escapeHtml(block.source.url)}" alt="Conversation Image" class="shared-image" loading="lazy" /></div>`;
      }
      return `<div class="image-box"><span class="image-placeholder">[Image]</span></div>`;

    default:
      return '';
  }
}

const INLINE_STYLES = `
:root {
  --bg-page: #f8fafc;
  --bg-card: #ffffff;
  --bg-user: #f0f9ff;
  --border-user: #bae6fd;
  --bg-assistant: #ffffff;
  --border-assistant: #e2e8f0;
  --bg-tool: #f1f5f9;
  --border-tool: #cbd5e1;
  --text-main: #0f172a;
  --text-muted: #64748b;
  --text-code: #0369a1;
  --bg-code: #f1f5f9;
  --bg-thinking: #f8fafc;
  --border-thinking: #e2e8f0;
  --badge-bg: #e2e8f0;
  --badge-text: #334155;
  --mark-bg: #fef08a;
  --mark-text: #854d0e;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-page: #0b0f19;
    --bg-card: #111827;
    --bg-user: #172554;
    --border-user: #1e3a8a;
    --bg-assistant: #111827;
    --border-assistant: #1f2937;
    --bg-tool: #090d16;
    --border-tool: #1e293b;
    --text-main: #f1f5f9;
    --text-muted: #94a3b8;
    --text-code: #38bdf8;
    --bg-code: #090d16;
    --bg-thinking: #0c1220;
    --border-thinking: #1e293b;
    --badge-bg: #1e293b;
    --badge-text: #cbd5e1;
    --mark-bg: #713f12;
    --mark-text: #fef08a;
  }
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: var(--bg-page);
  color: var(--text-main);
  line-height: 1.6;
  padding: 2rem 1rem;
}

.container {
  max-width: 860px;
  margin: 0 auto;
}

.chat-header {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-assistant);
}

.chat-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
  color: var(--text-main);
}

.chat-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.meta-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  background-color: var(--badge-bg);
  color: var(--badge-text);
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.message-card {
  padding: 1.25rem 1.5rem;
  border-radius: 12px;
  border: 1px solid var(--border-assistant);
  background-color: var(--bg-assistant);
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.message-card.user {
  background-color: var(--bg-user);
  border-color: var(--border-user);
}

.message-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  font-size: 0.85rem;
}

.sender-name {
  font-weight: 600;
  color: var(--text-main);
}

.message-time {
  color: var(--text-muted);
  font-size: 0.75rem;
}

.message-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Markdown typography */
.markdown-body {
  word-break: break-word;
}
.markdown-body p { margin-bottom: 0.85rem; }
.markdown-body p:last-child { margin-bottom: 0; }
.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
  font-weight: 600;
}
.markdown-body ul, .markdown-body ol {
  padding-left: 1.5rem;
  margin-bottom: 0.85rem;
}
.markdown-body li { margin-bottom: 0.25rem; }
.markdown-body blockquote {
  border-left: 3px solid var(--border-tool);
  padding-left: 1rem;
  color: var(--text-muted);
  margin-bottom: 0.85rem;
}
.markdown-body code:not(pre code) {
  background-color: var(--bg-code);
  color: var(--text-code);
  padding: 0.15rem 0.35rem;
  border-radius: 4px;
  font-size: 0.88em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.markdown-body pre {
  background-color: var(--bg-code);
  border: 1px solid var(--border-tool);
  border-radius: 8px;
  padding: 1rem;
  overflow-x: auto;
  margin-bottom: 0.85rem;
}
.markdown-body pre code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85rem;
  line-height: 1.5;
}
.markdown-body table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0.85rem;
}
.markdown-body th, .markdown-body td {
  border: 1px solid var(--border-tool);
  padding: 0.5rem 0.75rem;
  text-align: left;
}
.markdown-body th { background-color: var(--bg-tool); }

/* Thinking block */
.thinking-block {
  border: 1px solid var(--border-thinking);
  border-radius: 8px;
  background-color: var(--bg-thinking);
  padding: 0.75rem 1rem;
}
.thinking-summary {
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-muted);
  outline: none;
  user-select: none;
}
.thinking-content {
  margin-top: 0.75rem;
  font-size: 0.9rem;
  color: var(--text-muted);
}

/* Tool block */
.tool-box {
  border: 1px solid var(--border-tool);
  border-radius: 8px;
  background-color: var(--bg-tool);
  overflow: hidden;
}
.tool-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border-tool);
  font-size: 0.8rem;
}
.tool-badge {
  font-weight: 600;
  color: var(--text-muted);
}
.tool-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 600;
}
.tool-pre {
  padding: 0.75rem 1rem;
  overflow-x: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.82rem;
  line-height: 1.45;
}

/* Images */
.image-box { margin: 0.5rem 0; }
.shared-image {
  max-width: 100%;
  max-height: 500px;
  border-radius: 8px;
  object-fit: contain;
}
.image-placeholder {
  color: var(--text-muted);
  font-style: italic;
  font-size: 0.85rem;
}

/* Mark */
mark {
  background-color: var(--mark-bg);
  color: var(--mark-text);
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
}

/* Footer */
.chat-footer {
  margin-top: 3rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-assistant);
  text-align: center;
  font-size: 0.85rem;
  color: var(--text-muted);
}
.footer-title { margin-bottom: 0.25rem; }
.footer-stats { margin-bottom: 0.25rem; font-size: 0.8rem; }
.footer-date { font-size: 0.75rem; opacity: 0.8; }
`;

/**
 * Build a self-contained HTML page exporting the conversation.
 */
export function buildShareHtml(payload: SharePayload, opts: BuildShareHtmlOptions): string {
  const title = payload.session.title || 'Exported Conversation';

  const messagesHtml = payload.messages
    .map((message) => {
      const isUser = message.type === 'user';
      const senderName = isUser ? opts.userLabel : opts.assistantName;
      const formattedTime = message.timestamp ? new Date(message.timestamp).toLocaleString() : '';

      const blocksHtml = message.content.map(renderBlockHtml).filter(Boolean).join('\n');

      return `
      <article class="message-card ${isUser ? 'user' : 'assistant'}">
        <div class="message-meta">
          <span class="sender-name">${escapeHtml(senderName)}</span>
          ${formattedTime ? `<time class="message-time">${escapeHtml(formattedTime)}</time>` : ''}
        </div>
        <div class="message-body">
          ${blocksHtml}
        </div>
      </article>`;
    })
    .join('\n');

  const startTimeStr = payload.session.startTime
    ? new Date(payload.session.startTime).toLocaleString()
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
${INLINE_STYLES}
  </style>
</head>
<body>
  <div class="container">
    <header class="chat-header">
      <h1 class="chat-title">${escapeHtml(title)}</h1>
      <div class="chat-meta">
        <span class="meta-tag provider-tag">${escapeHtml(payload.session.provider)}</span>
        ${payload.session.model ? `<span class="meta-tag model-tag">${escapeHtml(payload.session.model)}</span>` : ''}
        ${payload.session.cwd ? `<span class="meta-item">📁 ${escapeHtml(payload.session.cwd)}</span>` : ''}
        ${startTimeStr ? `<span class="meta-item">🕒 ${escapeHtml(startTimeStr)}</span>` : ''}
      </div>
    </header>

    <main class="messages-list">
${messagesHtml}
    </main>

    <footer class="chat-footer">
      <p class="footer-title">Exported from <strong>AI Journal</strong></p>
      <p class="footer-stats">Redacted: ${payload.redactions.secrets} secret(s) · ${payload.redactions.paths} path(s) · ${payload.redactions.imagesStripped} image(s) stripped</p>
      <p class="footer-date">Exported at ${escapeHtml(new Date(payload.createdAt).toLocaleString())}</p>
    </footer>
  </div>
</body>
</html>`;
}
