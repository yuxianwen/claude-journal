import { describe, expect, it } from 'vitest';
import type { ConversationData, MessageFilters } from '@/types';
import { buildSharePayload, maskCwd, IMAGE_REMOVED_PLACEHOLDER } from './share-payload';
import { SHARE_SCHEMA_VERSION } from './share-types';
import { REDACTED_PATH, REDACTED_SECRET } from './share-redact';

function createMockConversationData(overrides?: Partial<ConversationData>): ConversationData {
  return {
    session: {
      id: 'session-123',
      provider: 'claude',
      projectId: 'project-456',
      title: 'Bug Fixing Session',
      startTime: '2026-09-01T10:00:00.000Z',
      endTime: '2026-09-01T11:00:00.000Z',
      messageCount: 3,
      toolCallCount: 1,
      tokenUsage: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 0, cacheCreateTokens: 0 },
      cwd: '/Users/alice/projects/awesome-app',
      model: 'claude-3-5-sonnet',
    },
    messages: [
      {
        uuid: 'msg-1',
        parentUuid: null,
        type: 'user',
        timestamp: '2026-09-01T10:01:00.000Z',
        isSidechain: false,
        content: [{ type: 'text', text: 'Hello, check /Users/alice/app.ts with API_KEY=secret12345' }],
      },
      {
        uuid: 'msg-sidechain',
        parentUuid: 'msg-1',
        type: 'user',
        timestamp: '2026-09-01T10:01:30.000Z',
        isSidechain: true,
        content: [{ type: 'text', text: 'Sidechain note should be dropped' }],
      },
      {
        uuid: 'msg-2',
        parentUuid: 'msg-1',
        type: 'assistant',
        timestamp: '2026-09-01T10:02:00.000Z',
        isSidechain: false,
        content: [
          { type: 'thinking', thinking: 'Thinking about /home/bob/server with sk-ant-1234567890abcdef' },
          {
            type: 'tool_use',
            id: 'call-1',
            name: 'Bash',
            input: { command: 'cat /Users/alice/projects/awesome-app/.env' },
          },
        ],
      },
      {
        uuid: 'msg-3',
        parentUuid: 'msg-2',
        type: 'user',
        timestamp: '2026-09-01T10:02:30.000Z',
        isSidechain: false,
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'call-1',
            content: [
              { type: 'text', text: 'DATABASE_URL=postgres://localhost:5432' },
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/png', data: 'huge-base64-data' },
              },
            ],
          },
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: 'another-base64-data' },
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('maskCwd', () => {
  it('masks Unix paths to ~/…/<basename>', () => {
    expect(maskCwd('/Users/alice/projects/awesome-app')).toBe('~/…/awesome-app');
    expect(maskCwd('/home/bob/repo/')).toBe('~/…/repo');
    expect(maskCwd('/var/log')).toBe('~/…/log');
  });

  it('masks Windows paths to ~/…/<basename>', () => {
    expect(maskCwd('C:\\Users\\Charlie\\Desktop\\cool-project')).toBe('~/…/cool-project');
    expect(maskCwd('C:/Users/Charlie/Desktop/cool-project')).toBe('~/…/cool-project');
  });

  it('handles root or empty paths', () => {
    expect(maskCwd('/')).toBe('~/…');
    expect(maskCwd('')).toBe('');
    expect(maskCwd(undefined)).toBeUndefined();
  });
});

describe('buildSharePayload', () => {
  const defaultFilters: MessageFilters = {
    thinking: true,
    tools: true,
    userMessages: true,
    assistantMessages: true,
  };

  it('sets version, createdAt, and masked cwd', () => {
    const data = createMockConversationData();
    const payload = buildSharePayload(data, defaultFilters);

    expect(payload.v).toBe(SHARE_SCHEMA_VERSION);
    expect(payload.session.cwd).toBe('~/…/awesome-app');
    expect(payload.session.title).toBe('Bug Fixing Session');
    expect(payload.session.provider).toBe('claude');
    expect(payload.session.model).toBe('claude-3-5-sonnet');
    expect(payload.createdAt).toBeTruthy();
  });

  it('drops sidechain messages', () => {
    const data = createMockConversationData();
    const payload = buildSharePayload(data, defaultFilters);

    const hasSidechain = payload.messages.some(m => m.isSidechain || m.uuid === 'msg-sidechain');
    expect(hasSidechain).toBe(false);
  });

  it('strips base64 image data by default and increments imagesStripped count', () => {
    const data = createMockConversationData();
    const payload = buildSharePayload(data, defaultFilters);

    expect(payload.redactions.imagesStripped).toBe(2);

    // Check msg-3 content
    const msg3 = payload.messages.find(m => m.uuid === 'msg-3')!;
    expect(msg3).toBeDefined();

    // Top-level image block replaced with text placeholder
    const topLevelImage = msg3.content[1];
    expect(topLevelImage).toEqual({ type: 'text', text: IMAGE_REMOVED_PLACEHOLDER });

    // Nested tool_result image replaced with text placeholder
    const toolResultBlock = msg3.content[0] as { content: Array<{ type: string; text?: string }> };
    expect(toolResultBlock.content[1]).toEqual({ type: 'text', text: IMAGE_REMOVED_PLACEHOLDER });
  });

  it('preserves images when includeImages is true', () => {
    const data = createMockConversationData();
    const payload = buildSharePayload(data, defaultFilters, { includeImages: true });

    expect(payload.redactions.imagesStripped).toBe(0);

    const msg3 = payload.messages.find(m => m.uuid === 'msg-3')!;
    const topLevelImage = msg3.content[1];
    expect(topLevelImage.type).toBe('image');
  });

  it('runs redaction pass and populates redactions counts', () => {
    const data = createMockConversationData();
    const payload = buildSharePayload(data, defaultFilters);

    // Paths in user message, thinking block, and tool_use input should be redacted
    expect(payload.redactions.paths).toBeGreaterThan(0);
    expect(payload.redactions.secrets).toBeGreaterThan(0);

    // Check msg-1 has path and secret redacted
    const msg1 = payload.messages.find(m => m.uuid === 'msg-1')!;
    const text = (msg1.content[0] as { text: string }).text;
    expect(text).toContain(REDACTED_PATH);
    expect(text).toContain(REDACTED_SECRET);
    expect(text).not.toContain('/Users/alice');
    expect(text).not.toContain('secret12345');
  });

  it('filters thinking blocks when thinking filter is false', () => {
    const data = createMockConversationData();
    const payload = buildSharePayload(data, { ...defaultFilters, thinking: false });

    const msg2 = payload.messages.find(m => m.uuid === 'msg-2')!;
    const hasThinking = msg2.content.some(b => b.type === 'thinking');
    expect(hasThinking).toBe(false);
  });

  it('filters tool_use and tool_result blocks when tools filter is false', () => {
    const data = createMockConversationData();
    const payload = buildSharePayload(data, { ...defaultFilters, tools: false });

    for (const msg of payload.messages) {
      const hasTools = msg.content.some(b => b.type === 'tool_use' || b.type === 'tool_result');
      expect(hasTools).toBe(false);
    }
  });

  it('filters user or assistant messages when corresponding filter is false', () => {
    const data = createMockConversationData();
    const payloadNoUser = buildSharePayload(data, { ...defaultFilters, userMessages: false });
    expect(payloadNoUser.messages.every(m => m.type === 'assistant')).toBe(true);

    const payloadNoAssistant = buildSharePayload(data, { ...defaultFilters, assistantMessages: false });
    expect(payloadNoAssistant.messages.every(m => m.type === 'user')).toBe(true);
  });
});
