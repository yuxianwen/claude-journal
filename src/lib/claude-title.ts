// Shared Claude Code session-title extraction.
//
// Used by BOTH readers — the server-side one (reader.ts) and the browser
// File System Access one (fs-reader.ts). Keep it here: the two readers drifted
// apart once already and the browser path silently lost AI-title support, which
// is exactly the title `/resume` shows.

type Line = Record<string, unknown>;

// Slash commands that say nothing about what the session was about.
const NOISE_COMMANDS = new Set([
  'clear', 'compact', 'resume', 'init', 'exit', 'quit', 'login', 'logout',
  'help', 'model', 'context', 'cost', 'status', 'doctor', 'config', 'review',
]);

function messageText(line: Line): string {
  const raw = (line.message as { content?: unknown } | undefined)?.content;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    const block = raw.find((c: { type: string; text?: string }) => c.type === 'text');
    return block?.text || '';
  }
  return '';
}

/**
 * Resolve a session title the same way Claude Code's own `/resume` picker does:
 *   1. an explicit user rename (`custom-title`)
 *   2. the AI-generated title (`ai-title`) — rewritten as the chat grows, so
 *      take the LAST one
 *   3. fallback: the first meaningful user message, skipping noise slash
 *      commands (`/clear`, `/compact`, …) and injected context tags
 */
export function extractClaudeTitle(lines: Line[], sessionId: string): string {
  let customTitle = '';
  let aiTitle = '';

  for (const line of lines) {
    if (line.type === 'custom-title' && typeof line.customTitle === 'string') {
      customTitle = line.customTitle;
    }
    if (line.type === 'ai-title' && typeof line.aiTitle === 'string' && line.aiTitle) {
      aiTitle = line.aiTitle; // keep the latest
    }
  }

  if (customTitle) return customTitle;
  if (aiTitle) return aiTitle;

  for (const line of lines) {
    if (line.type !== 'user') continue;
    const text = messageText(line);
    if (!text.trim()) continue;

    const cmdMatch = text.match(/<command-name>([\s\S]*?)<\/command-name>/i);
    if (cmdMatch && cmdMatch[1].trim()) {
      const cmd = cmdMatch[1].trim().replace(/^\//, '');
      if (NOISE_COMMANDS.has(cmd)) continue; // keep looking for a real prompt
      const args = (text.match(/<command-args>([\s\S]*?)<\/command-args>/i)?.[1] || '').trim();
      const label = args ? `/${cmd} ${args}` : `/${cmd}`;
      return label.length > 60 ? label.slice(0, 60) + '...' : label;
    }

    const cleaned = text
      .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/gi, '')
      .replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/gi, '')
      .replace(/<environment_context>[\s\S]*?<\/environment_context>/gi, '')
      .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, '')
      .replace(/<command-[a-z-]+>[\s\S]*?<\/command-[a-z-]+>/gi, '')
      .replace(/<bash-(?:input|stdout|stderr)>[\s\S]*?<\/bash-(?:input|stdout|stderr)>/gi, '')
      .trim();

    if (cleaned) {
      return cleaned.length > 60 ? cleaned.slice(0, 60) + '...' : cleaned;
    }
  }

  return sessionId.slice(0, 8);
}
