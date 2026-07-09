import { ContentBlock, Message, SessionMeta, TokenUsage } from '@/types';

export function emptyUsage(): TokenUsage {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreateTokens: 0 };
}

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheCreateTokens: a.cacheCreateTokens + b.cacheCreateTokens,
  };
}

export function parseLines(content: string): Array<Record<string, unknown>> {
  return content.split('\n').filter(Boolean).map(line => {
    try { return JSON.parse(line) as Record<string, unknown>; } catch { return null; }
  }).filter((line): line is Record<string, unknown> => Boolean(line));
}

function payloadOf(line: Record<string, unknown>): Record<string, unknown> {
  const payload = line.payload;
  return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
}

function codexContentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map(block => {
    if (!block || typeof block !== 'object') return '';
    const b = block as Record<string, unknown>;
    return typeof b.text === 'string' ? b.text : '';
  }).filter(Boolean).join('\n');
}

function projectIdFromCwd(cwd: string): string {
  if (!cwd) return 'unknown';
  return cwd.replace(/^[\\/]+/, '-').replace(/[\\/]+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '-');
}

function parseJsonObject(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object' && !Array.isArray(input)) return input as Record<string, unknown>;
  if (typeof input !== 'string' || !input.trim()) return {};
  try {
    const parsed = JSON.parse(input);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { value: parsed };
  } catch {
    return { raw: input };
  }
}

function looksLikeInjectedContext(text: string): boolean {
  const t = text.trim();
  return t.startsWith('# AGENTS.md instructions')
    || t.startsWith('<environment_context>')
    || t.startsWith('<INSTRUCTIONS>')
    || t.startsWith('You are Codex,')
    || t.startsWith('You are an AI assistant')
    || t.includes('<cwd>') && t.includes('<shell>')
    || t.includes('<permissions instructions>');
}

function compactTitle(text: string): string {
  const oneLine = text.trim().replace(/\s+/g, ' ');
  return oneLine.slice(0, 60) + (oneLine.length > 60 ? '...' : '');
}

function fallbackTitle(sessionId: string): string {
  const fileName = sessionId.split('/').pop() || sessionId;
  return fileName.replace(/\.jsonl$/, '').replace(/^rollout-/, '').slice(0, 60);
}

export function parseCodexSessionMeta(sessionId: string, content: string, mtimeMs = 0): SessionMeta {
  const lines = parseLines(content);
  const meta = lines.find(line => line.type === 'session_meta');
  const metaPayload = meta ? payloadOf(meta) : {};

  let cwd = String(metaPayload.cwd || '');
  let model = String(metaPayload.model_provider || '');
  let startTime = String(metaPayload.timestamp || meta?.timestamp || '');
  let endTime = startTime;
  let title = '';
  let messageCount = 0;
  let toolCallCount = 0;
  let tokenUsage = emptyUsage();

  for (const line of lines) {
    const timestamp = typeof line.timestamp === 'string' ? line.timestamp : '';
    if (timestamp) {
      if (!startTime) startTime = timestamp;
      endTime = timestamp;
    }

    const payload = payloadOf(line);
    if (line.type === 'turn_context') {
      if (!cwd && typeof payload.cwd === 'string') cwd = payload.cwd;
      if (!model && typeof payload.model === 'string') model = payload.model;
    }

    if (line.type === 'response_item') {
      if (payload.type === 'function_call') toolCallCount++;
      if (payload.type === 'message' && (payload.role === 'user' || payload.role === 'assistant')) {
        const text = codexContentText(payload.content).trim();
        if (!text) continue;
        messageCount++;
        if (!title && payload.role === 'user' && !looksLikeInjectedContext(text)) {
          title = compactTitle(text);
        }
      }
    }

    if (line.type === 'event_msg' && payload.type === 'token_count') {
      const info = payload.info && typeof payload.info === 'object' ? payload.info as Record<string, unknown> : {};
      const total = info.total_token_usage && typeof info.total_token_usage === 'object'
        ? info.total_token_usage as Record<string, unknown>
        : null;
      if (total) {
        tokenUsage = {
          inputTokens: Number(total.input_tokens || 0),
          outputTokens: Number(total.output_tokens || 0),
          cacheReadTokens: Number(total.cached_input_tokens || 0),
          cacheCreateTokens: 0,
        };
      }
    }
  }

  if (!title) title = fallbackTitle(sessionId);
  if (!endTime && mtimeMs) endTime = new Date(mtimeMs).toISOString();
  if (!startTime) startTime = endTime;

  return {
    id: sessionId,
    provider: 'codex',
    projectId: projectIdFromCwd(cwd),
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

function pushMessage(messages: Message[], message: Message) {
  if (message.content.length > 0) messages.push(message);
}

export function buildCodexMessages(content: string, fallbackEndTime: string): Message[] {
  const messages: Message[] = [];
  let pendingToolResults: ContentBlock[] = [];

  for (const line of parseLines(content)) {
    if (line.type !== 'response_item') continue;
    const payload = payloadOf(line);
    const timestamp = typeof line.timestamp === 'string' ? line.timestamp : '';

    if (payload.type === 'function_call_output') {
      const id = String(payload.call_id || '');
      if (id) {
        pendingToolResults.push({ type: 'tool_result', tool_use_id: id, content: String(payload.output || '') });
      }
      continue;
    }

    if (pendingToolResults.length > 0) {
      pushMessage(messages, {
        uuid: `tool-results-${messages.length}`,
        parentUuid: null,
        type: 'user',
        timestamp,
        content: pendingToolResults,
        isSidechain: false,
      });
      pendingToolResults = [];
    }

    if (payload.type === 'message') {
      if (payload.role !== 'user' && payload.role !== 'assistant') continue;
      const text = codexContentText(payload.content);
      pushMessage(messages, {
        uuid: String(payload.id || `message-${messages.length}`),
        parentUuid: null,
        type: payload.role as 'user' | 'assistant',
        timestamp,
        content: text.trim() ? [{ type: 'text', text }] : [],
        isSidechain: false,
      });
      continue;
    }

    if (payload.type === 'function_call') {
      const id = String(payload.call_id || payload.id || `tool-${messages.length}`);
      pushMessage(messages, {
        uuid: id,
        parentUuid: null,
        type: 'assistant',
        timestamp,
        content: [{
          type: 'tool_use',
          id,
          name: [payload.namespace, payload.name].filter(Boolean).join('.') || 'tool',
          input: parseJsonObject(payload.arguments),
        }],
        isSidechain: false,
      });
    }
  }

  if (pendingToolResults.length > 0) {
    pushMessage(messages, {
      uuid: `tool-results-${messages.length}`,
      parentUuid: null,
      type: 'user',
      timestamp: fallbackEndTime,
      content: pendingToolResults,
      isSidechain: false,
    });
  }

  return messages;
}

export function codexMessageText(message: Message): string {
  return message.content.map(block => {
    if (block.type === 'text') return block.text;
    if (block.type === 'thinking') return block.thinking;
    if (block.type === 'tool_use') return `${block.name} ${JSON.stringify(block.input)}`;
    if (block.type === 'tool_result') return typeof block.content === 'string' ? block.content : '';
    return '';
  }).filter(Boolean).join(' ');
}
