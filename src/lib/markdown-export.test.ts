import { describe, expect, it } from 'vitest';
import type { ConversationData } from '@/types';
import { conversationToMarkdown } from './markdown-export';

describe('conversationToMarkdown', () => {
  it('exports full thinking, tool results, and safe image references without truncation', () => {
    const longThinking = 'reasoning '.repeat(80);
    const data: ConversationData = {
      session: {
        id: 'session-1', provider: 'claude', projectId: 'project-1', title: 'Export test',
        startTime: '2026-07-10T00:00:00.000Z', endTime: '2026-07-10T00:01:00.000Z',
        messageCount: 2, toolCallCount: 1,
        tokenUsage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheCreateTokens: 0 },
        cwd: '/tmp/project', model: 'test-model',
      },
      messages: [
        {
          uuid: 'assistant-1', parentUuid: null, type: 'assistant', timestamp: '', isSidechain: false,
          content: [
            { type: 'thinking', thinking: longThinking },
            { type: 'tool_use', id: 'call-1', name: 'Bash', input: { command: 'pnpm test' } },
          ],
        },
        {
          uuid: 'result-1', parentUuid: 'assistant-1', type: 'user', timestamp: '', isSidechain: false,
          content: [
            { type: 'tool_result', tool_use_id: 'call-1', content: 'all tests passed' },
            { type: 'image', source: { type: 'url', url: 'https://example.com/private.png' } },
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'large-data' } },
          ],
        },
      ],
    };

    const markdown = conversationToMarkdown(data, 'User', 'Claude');

    expect(markdown).toContain(longThinking);
    expect(markdown).toContain('Tool result: call-1');
    expect(markdown).toContain('all tests passed');
    expect(markdown).toContain('[External image: https://example.com/private.png]');
    expect(markdown).toContain('[Embedded image: image/png]');
    expect(markdown).not.toContain('large-data');
    expect(markdown).not.toContain('truncated');
  });
});
