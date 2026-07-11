import { describe, expect, it } from 'vitest';
import type { Message } from '@/types';
import { collectToolResults } from './tool-results';

describe('collectToolResults', () => {
  it('links outputs even when they live in a result-only hidden message', () => {
    const messages: Message[] = [
      {
        uuid: 'assistant-tool',
        parentUuid: null,
        type: 'assistant',
        timestamp: '',
        isSidechain: false,
        content: [{ type: 'tool_use', id: 'call-1', name: 'Bash', input: { command: 'pwd' } }],
      },
      {
        uuid: 'hidden-result',
        parentUuid: 'assistant-tool',
        type: 'user',
        timestamp: '',
        isSidechain: false,
        content: [{ type: 'tool_result', tool_use_id: 'call-1', content: '/tmp/project' }],
      },
      {
        uuid: 'assistant-final',
        parentUuid: 'hidden-result',
        type: 'assistant',
        timestamp: '',
        isSidechain: false,
        content: [{ type: 'text', text: 'Done' }],
      },
    ];

    expect(collectToolResults(messages).get('call-1')).toBe('/tmp/project');
  });
});
