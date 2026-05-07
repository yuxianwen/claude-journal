import { Project, SessionMeta, TokenUsage, Message, ContentBlock, ConversationData } from '@/types';

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

function parseLines(content: string) {
  return content.split('\n').filter(Boolean).map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

function parseSessionMeta(projectId: string, sessionId: string, content: string): SessionMeta {
  const lines = parseLines(content);

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

    if (line.type === 'user') {
      if (!cwd && line.cwd) cwd = line.cwd;
      if (!startTime && line.timestamp) startTime = line.timestamp;
      if (line.timestamp) endTime = line.timestamp;

      const content = line.message?.content;
      if (typeof content === 'string' && content.trim()) {
        messageCount++;
      } else if (Array.isArray(content)) {
        if (content.some((c: { type: string }) => c.type === 'text')) messageCount++;
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

      const c = line.message?.content;
      if (Array.isArray(c)) {
        toolCallCount += c.filter((b: { type: string }) => b.type === 'tool_use').length;
      }
    }
  }

  if (!title) {
    const firstUser = lines.find(l => l.type === 'user');
    const rawContent = firstUser?.message?.content;
    if (typeof rawContent === 'string') {
      title = rawContent.slice(0, 60) + (rawContent.length > 60 ? '...' : '');
    } else if (Array.isArray(rawContent)) {
      const textBlock = rawContent.find((c: { type: string; text?: string }) => c.type === 'text');
      const text = textBlock?.text || '';
      title = text.slice(0, 60) + (text.length > 60 ? '...' : '');
    }
    if (!title) title = sessionId.slice(0, 8);
  }

  return { id: sessionId, projectId, title, startTime, endTime, messageCount, toolCallCount, tokenUsage, cwd, model };
}

export async function getAllProjects(dirHandle: FileSystemDirectoryHandle): Promise<Project[]> {
  const projects: Project[] = [];

  for await (const [dirName, projectHandle] of dirHandle.entries()) {
    if (projectHandle.kind !== 'directory') continue;

    const sessions: SessionMeta[] = [];

    for await (const [fileName, fileHandle] of (projectHandle as FileSystemDirectoryHandle).entries()) {
      if (fileHandle.kind !== 'file' || !fileName.endsWith('.jsonl')) continue;

      const file = await (fileHandle as FileSystemFileHandle).getFile();
      const content = await file.text();
      const sessionId = fileName.replace(/\.jsonl$/, '');
      sessions.push(parseSessionMeta(dirName, sessionId, content));
    }

    if (sessions.length === 0) continue;

    sessions.sort((a, b) => b.endTime.localeCompare(a.endTime));

    const cwd = sessions[0]?.cwd || dirName.replace(/^-/, '/').replace(/-/g, '/');
    const name = cwd ? cwd.split('/').filter(Boolean).pop() || dirName : dirName;
    const totalTokens = sessions.reduce((acc, s) => addUsage(acc, s.tokenUsage), emptyUsage());

    projects.push({ id: dirName, name, cwd, sessions, totalTokens });
  }

  return projects.sort((a, b) => {
    const aLatest = a.sessions[0]?.endTime || '';
    const bLatest = b.sessions[0]?.endTime || '';
    return bLatest.localeCompare(aLatest);
  });
}

export async function getSession(
  dirHandle: FileSystemDirectoryHandle,
  projectId: string,
  sessionId: string
): Promise<ConversationData | null> {
  let projectHandle: FileSystemDirectoryHandle;
  try {
    projectHandle = await dirHandle.getDirectoryHandle(projectId);
  } catch {
    return null;
  }

  let fileHandle: FileSystemFileHandle;
  try {
    fileHandle = await projectHandle.getFileHandle(`${sessionId}.jsonl`);
  } catch {
    return null;
  }

  const file = await fileHandle.getFile();
  const content = await file.text();
  const lines = parseLines(content);

  const sessionMeta = parseSessionMeta(projectId, sessionId, content);
  const messages: Message[] = [];

  for (const line of lines) {
    if (line.type !== 'user' && line.type !== 'assistant') continue;

    const rawContent = line.message?.content;
    let blocks: ContentBlock[] = [];

    if (typeof rawContent === 'string') {
      if (rawContent.trim()) blocks = [{ type: 'text', text: rawContent }];
    } else if (Array.isArray(rawContent)) {
      blocks = rawContent.map((c: Record<string, unknown>) => {
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
        };
        return { type: 'text' as const, text: JSON.stringify(c) };
      });
    }

    if (blocks.length === 0) continue;

    const usage = line.message?.usage;
    messages.push({
      uuid: line.uuid || '',
      parentUuid: line.parentUuid || null,
      type: line.type,
      timestamp: line.timestamp || '',
      content: blocks,
      isSidechain: line.isSidechain || false,
      usage: usage ? {
        inputTokens: usage.input_tokens || 0,
        outputTokens: usage.output_tokens || 0,
        cacheReadTokens: usage.cache_read_input_tokens || 0,
        cacheCreateTokens: usage.cache_creation_input_tokens || 0,
      } : undefined,
    });
  }

  return { session: sessionMeta, messages };
}

export interface SearchResult {
  session: SessionMeta;
  projectName: string;
  excerpt: string;
}

export async function searchSessions(
  dirHandle: FileSystemDirectoryHandle,
  query: string
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  const results: SearchResult[] = [];

  for await (const [dirName, projectHandle] of dirHandle.entries()) {
    if (projectHandle.kind !== 'directory') continue;

    for await (const [fileName, fileHandle] of (projectHandle as FileSystemDirectoryHandle).entries()) {
      if (fileHandle.kind !== 'file' || !fileName.endsWith('.jsonl')) continue;

      const file = await (fileHandle as FileSystemFileHandle).getFile();
      const content = await file.text();

      const idx = content.toLowerCase().indexOf(lowerQuery);
      if (idx === -1) continue;

      const sessionId = fileName.replace(/\.jsonl$/, '');
      const session = parseSessionMeta(dirName, sessionId, content);
      const cwd = session.cwd || dirName.replace(/^-/, '/').replace(/-/g, '/');
      const projectName = cwd ? cwd.split('/').filter(Boolean).pop() || dirName : dirName;

      const start = Math.max(0, idx - 80);
      const end = Math.min(content.length, idx + query.length + 80);
      const excerpt = (start > 0 ? '...' : '') + content.slice(start, end).replace(/\n/g, ' ') + (end < content.length ? '...' : '');

      results.push({ session, projectName, excerpt });
      if (results.length >= 50) return results;
    }
  }

  return results;
}
