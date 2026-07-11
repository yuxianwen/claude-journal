import { describe, expect, it } from 'vitest';
import { buildCodexMessages, parseCodexSessionMeta } from './codex-shared';

function jsonl(lines: Array<Record<string, unknown>>) {
  return lines.map(line => JSON.stringify(line)).join('\n');
}

describe('Codex session normalization', () => {
  const content = jsonl([
    {
      type: 'session_meta',
      timestamp: '2026-07-10T01:00:00.000Z',
      payload: {
        cwd: '/Users/example/AI Journal',
        timestamp: '2026-07-10T01:00:00.000Z',
        model_provider: 'openai',
      },
    },
    {
      type: 'response_item',
      timestamp: '2026-07-10T01:00:01.000Z',
      payload: {
        id: 'injected',
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: '# AGENTS.md instructions for /tmp/project' }],
      },
    },
    {
      type: 'response_item',
      timestamp: '2026-07-10T01:00:02.000Z',
      payload: {
        id: 'user-1',
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'Fix the export flow' }],
      },
    },
    {
      type: 'response_item',
      timestamp: '2026-07-10T01:00:03.000Z',
      payload: {
        id: 'call-item',
        call_id: 'call-1',
        type: 'function_call',
        name: 'exec_command',
        arguments: JSON.stringify({ cmd: 'pnpm test' }),
      },
    },
    {
      type: 'response_item',
      timestamp: '2026-07-10T01:00:04.000Z',
      payload: {
        call_id: 'call-1',
        type: 'function_call_output',
        output: 'Process exited with code 0',
      },
    },
    {
      type: 'response_item',
      timestamp: '2026-07-10T01:00:05.000Z',
      payload: {
        id: 'assistant-1',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'Export fixed.' }],
      },
    },
    {
      type: 'event_msg',
      timestamp: '2026-07-10T01:00:06.000Z',
      payload: {
        type: 'token_count',
        info: {
          total_token_usage: {
            input_tokens: 120,
            output_tokens: 30,
            cached_input_tokens: 40,
          },
        },
      },
    },
  ]);

  it('uses the first real user request as the title', () => {
    const meta = parseCodexSessionMeta('2026/07/10/rollout-example.jsonl', content);

    expect(meta.title).toBe('Fix the export flow');
    expect(meta.projectId).toBe('-Users-example-AI-Journal');
    expect(meta.toolCallCount).toBe(1);
    expect(meta.tokenUsage).toEqual({
      inputTokens: 120,
      outputTokens: 30,
      cacheReadTokens: 40,
      cacheCreateTokens: 0,
    });
  });

  it('keeps tool calls and their outputs linked by call id', () => {
    const messages = buildCodexMessages(content, '2026-07-10T01:00:06.000Z');
    const toolCall = messages.flatMap(message => message.content)
      .find(block => block.type === 'tool_use');
    const toolResult = messages.flatMap(message => message.content)
      .find(block => block.type === 'tool_result');

    expect(toolCall).toMatchObject({
      type: 'tool_use',
      id: 'call-1',
      name: 'exec_command',
      input: { cmd: 'pnpm test' },
    });
    expect(toolResult).toMatchObject({
      type: 'tool_result',
      tool_use_id: 'call-1',
      content: 'Process exited with code 0',
    });
  });
});
