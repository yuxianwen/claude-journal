import fs from 'fs';
import path from 'path';
import os from 'os';
import { Project, SessionMeta, TokenUsage, Message, ContentBlock, ConversationData } from '@/types';

function getProjectsDir(): string {
  if (process.platform === 'win32') {
    return path.join(/* turbopackIgnore: true */ os.homedir(), 'AppData', 'Roaming', 'Claude', 'projects');
  }
  return path.join(/* turbopackIgnore: true */ os.homedir(), '.claude', 'projects');
}

const PROJECTS_DIR = getProjectsDir();

function emptyUsage(): TokenUsage {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreateTokens: 0 };
}

function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheCreateTokens: a.cacheCreateTokens + b.cacheCreateTokens,
  };
}

// Cache parsed session metadata keyed by file path, invalidated by mtime.
// Lets repeated getAllProjects() calls (polling) re-parse only changed files.
const metaCache = new Map<string, { mtimeMs: number; meta: SessionMeta }>();

function getSessionMetaCached(filePath: string, mtimeMs: number): SessionMeta {
  const hit = metaCache.get(filePath);
  if (hit && hit.mtimeMs === mtimeMs) return hit.meta;
  const meta = parseSessionFile(filePath);
  metaCache.set(filePath, { mtimeMs, meta });
  return meta;
}

export function getSessionMtime(projectId: string, sessionId: string): number | null {
  const filePath = path.join(PROJECTS_DIR, projectId, `${sessionId}.jsonl`);
  try {
    return fs.statSync(/* turbopackIgnore: true */ filePath).mtimeMs;
  } catch {
    return null;
  }
}

function parseSessionFile(filePath: string): SessionMeta {
  const content = fs.readFileSync(/* turbopackIgnore: true */ filePath, 'utf-8');
  const lines = content.split('\n').filter(Boolean).map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);

  const sessionId = path.basename(filePath, '.jsonl');
  const projectId = path.basename(path.dirname(filePath));

  let title = '';
  let cwd = '';
  let model = '';
  let startTime = '';
  let endTime = '';
  let messageCount = 0;
  let toolCallCount = 0;
  let tokenUsage = emptyUsage();

  for (const line of lines) {
    if (line.type === 'custom-title') {
      title = line.customTitle || '';
    }

    if (line.type === 'ai-title' && !title) {
      title = line.aiTitle || '';
    }

    if (line.type === 'user') {
      if (!cwd && line.cwd) cwd = line.cwd;
      if (!startTime && line.timestamp) startTime = line.timestamp;
      if (line.timestamp) endTime = line.timestamp;

      const content = line.message?.content;
      if (typeof content === 'string' && content.trim()) {
        messageCount++;
      } else if (Array.isArray(content)) {
        const hasText = content.some((c: { type: string }) => c.type === 'text');
        if (hasText) messageCount++;
      }
    }

    if (line.type === 'assistant') {
      if (line.timestamp) endTime = line.timestamp;
      messageCount++;

      const usage = line.message?.usage;
      if (usage) {
        tokenUsage = addUsage(tokenUsage, {
          inputTokens: usage.input_tokens || 0,
          outputTokens: usage.output_tokens || 0,
          cacheReadTokens: usage.cache_read_input_tokens || 0,
          cacheCreateTokens: usage.cache_creation_input_tokens || 0,
        });
      }

      if (!model && line.message?.model && line.message.model !== '<synthetic>') {
        model = line.message.model;
      }

      const content = line.message?.content;
      if (Array.isArray(content)) {
        toolCallCount += content.filter((c: { type: string }) => c.type === 'tool_use').length;
      }
    }
  }

  if (!title) {
    for (const line of lines) {
      if (line.type !== 'user') continue;
      let text = '';
      const rawContent = line.message?.content;
      if (typeof rawContent === 'string') {
        text = rawContent;
      } else if (Array.isArray(rawContent)) {
        const textBlock = rawContent.find((c: { type: string; text?: string }) => c.type === 'text');
        text = textBlock?.text || '';
      }

      // Extract slash command if present
      const cmdMatch = text.match(/<command-name>([\s\S]*?)<\/command-name>/i);
      if (cmdMatch && cmdMatch[1].trim()) {
        title = cmdMatch[1].trim();
        break;
      }

      // Clean out injected context tags and command boilerplate
      const cleaned = text
        .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/gi, '')
        .replace(/<environment_context>[\s\S]*?<\/environment_context>/gi, '')
        .replace(/<command-[a-z-]+>[\s\S]*?<\/command-[a-z-]+>/gi, '')
        .trim();

      if (cleaned) {
        title = cleaned.slice(0, 60) + (cleaned.length > 60 ? '...' : '');
        break;
      }
    }
    if (!title) title = sessionId.slice(0, 8);
  }

  return {
    id: sessionId,
    provider: 'claude',
    projectId,
    title,
    startTime,
    endTime,
    messageCount,
    toolCallCount,
    tokenUsage,
    cwd,
    model,
  };
}

export function getAllProjects(): Project[] {
  if (!fs.existsSync(/* turbopackIgnore: true */ PROJECTS_DIR)) return [];

  const projectDirs = fs.readdirSync(/* turbopackIgnore: true */ PROJECTS_DIR).filter(name => {
    return fs.statSync(/* turbopackIgnore: true */ path.join(PROJECTS_DIR, name)).isDirectory();
  });

  const projects: Project[] = [];

  for (const dirName of projectDirs) {
    const dirPath = path.join(PROJECTS_DIR, dirName);
    const sessionFiles = fs.readdirSync(/* turbopackIgnore: true */ dirPath).filter(f => f.endsWith('.jsonl'));

    if (sessionFiles.length === 0) continue;

    const sessions: SessionMeta[] = sessionFiles.map(f => {
      const fp = path.join(dirPath, f);
      return getSessionMetaCached(fp, fs.statSync(/* turbopackIgnore: true */ fp).mtimeMs);
    }).sort((a, b) => b.endTime.localeCompare(a.endTime));

    const cwd = sessions[0]?.cwd || dirName.replace(/^-/, '/').replace(/-/g, '/');
    const name = cwd ? path.basename(cwd) : dirName;

    const totalTokens = sessions.reduce(
      (acc, s) => addUsage(acc, s.tokenUsage),
      emptyUsage()
    );

    projects.push({ id: dirName, provider: 'claude', name, cwd, sessions, totalTokens });
  }

  return projects.sort((a, b) => {
    const aLatest = a.sessions[0]?.endTime || '';
    const bLatest = b.sessions[0]?.endTime || '';
    return bLatest.localeCompare(aLatest);
  });
}

export function getSession(projectId: string, sessionId: string): ConversationData | null {
  const filePath = path.join(PROJECTS_DIR, projectId, `${sessionId}.jsonl`);
  if (!fs.existsSync(/* turbopackIgnore: true */ filePath)) return null;

  const mtimeMs = fs.statSync(/* turbopackIgnore: true */ filePath).mtimeMs;
  const content = fs.readFileSync(/* turbopackIgnore: true */ filePath, 'utf-8');
  const lines = content.split('\n').filter(Boolean).map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);

  const sessionMeta = parseSessionFile(filePath);
  const messages: Message[] = [];

  for (const line of lines) {
    if (line.type !== 'user' && line.type !== 'assistant') continue;

    const rawContent = line.message?.content;
    let content: ContentBlock[] = [];

    if (typeof rawContent === 'string') {
      if (rawContent.trim()) {
        content = [{ type: 'text', text: rawContent }];
      }
    } else if (Array.isArray(rawContent)) {
      content = rawContent.map((c: Record<string, unknown>) => {
        if (c.type === 'text') return { type: 'text' as const, text: String(c.text || '') };
        if (c.type === 'thinking') return { type: 'thinking' as const, thinking: String(c.thinking || '') };
        if (c.type === 'redacted_thinking') return { type: 'thinking' as const, thinking: '' };
        if (c.type === 'tool_use') return {
          type: 'tool_use' as const,
          id: String(c.id || ''),
          name: String(c.name || ''),
          input: (c.input as Record<string, unknown>) || {},
        };
        if (c.type === 'tool_result') return {
          type: 'tool_result' as const,
          tool_use_id: String(c.tool_use_id || ''),
          content: c.content as string | ContentBlock[],
          isError: Boolean(c.is_error),
        };
        if (c.type === 'image') return {
          type: 'image' as const,
          source: (c.source as { type: string; url?: string; media_type?: string; data?: string }) || { type: 'base64' },
        };
        return { type: 'text' as const, text: JSON.stringify(c) };
      });
    }

    if (content.length === 0) continue;

    const usage = line.message?.usage;
    messages.push({
      uuid: line.uuid || '',
      parentUuid: line.parentUuid || null,
      type: line.type,
      timestamp: line.timestamp || '',
      content,
      isSidechain: line.isSidechain || false,
      usage: usage ? {
        inputTokens: usage.input_tokens || 0,
        outputTokens: usage.output_tokens || 0,
        cacheReadTokens: usage.cache_read_input_tokens || 0,
        cacheCreateTokens: usage.cache_creation_input_tokens || 0,
      } : undefined,
    });
  }

  return { session: sessionMeta, messages, mtimeMs };
}

function extractMessageText(line: Record<string, unknown>): string {
  const rawContent = (line.message as Record<string, unknown>)?.content;
  if (typeof rawContent === 'string') return rawContent;
  if (Array.isArray(rawContent)) {
    return rawContent.map((c: Record<string, unknown>) => {
      if (c.type === 'text') return String(c.text || '');
      if (c.type === 'thinking') return String(c.thinking || '');
      return '';
    }).filter(Boolean).join(' ');
  }
  return '';
}

export function searchSessions(query: string): Array<{ session: SessionMeta; projectName: string; excerpt: string; messageUuid: string }> {
  if (!query.trim()) return [];

  const projects = getAllProjects();
  const results: Array<{ session: SessionMeta; projectName: string; excerpt: string; messageUuid: string }> = [];
  const lowerQuery = query.toLowerCase();

  for (const project of projects) {
    for (const session of project.sessions) {
      const filePath = path.join(PROJECTS_DIR, project.id, `${session.id}.jsonl`);
      const rawContent = fs.readFileSync(/* turbopackIgnore: true */ filePath, 'utf-8');
      const lines = rawContent.split('\n').filter(Boolean);

      for (const rawLine of lines) {
        let parsed: Record<string, unknown>;
        try { parsed = JSON.parse(rawLine); } catch { continue; }
        if (parsed.type !== 'user' && parsed.type !== 'assistant') continue;

        const text = extractMessageText(parsed);
        const idx = text.toLowerCase().indexOf(lowerQuery);
        if (idx === -1) continue;

        const uuid = String(parsed.uuid || '');
        const start = Math.max(0, idx - 80);
        const end = Math.min(text.length, idx + query.length + 80);
        const excerpt = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');

        results.push({ session, projectName: project.name, excerpt, messageUuid: uuid });
        break;
      }

      if (results.length >= 50) return results;
    }
  }

  return results;
}
