import { describe, expect, it } from 'vitest';
import type { ConversationData, Message } from '@/types';
import { summarizeConversation } from './session-summary';

function message(
  uuid: string,
  type: Message['type'],
  content: Message['content'],
): Message {
  return { uuid, parentUuid: null, type, content, timestamp: '', isSidechain: false };
}

describe('summarizeConversation', () => {
  it('extracts only evidence-backed goals, outcomes, files, failures, and commits', () => {
    const messages: Message[] = [
      message('injected', 'user', [{ type: 'text', text: '# AGENTS.md instructions for /tmp/project' }]),
      message('goal', 'user', [{ type: 'text', text: 'Fix the export flow and add tests.' }]),
      message('write', 'assistant', [{
        type: 'tool_use', id: 'write-1', name: 'Write', input: { file_path: '/tmp/project/export.ts' },
      }]),
      message('write-result', 'user', [{
        type: 'tool_result', tool_use_id: 'write-1', content: 'File written',
      }]),
      message('patch', 'assistant', [{
        type: 'tool_use', id: 'patch-1', name: 'apply_patch', input: {
          patch: '*** Update File: /tmp/project/export.ts\n*** Add File: /tmp/project/export.test.ts',
        },
      }]),
      message('patch-result', 'user', [{
        type: 'tool_result', tool_use_id: 'patch-1', content: 'Done!',
      }]),
      message('commit', 'assistant', [{
        type: 'tool_use', id: 'commit-1', name: 'Bash', input: { command: 'git commit -m "Fix export"' },
      }]),
      message('commit-result', 'user', [{
        type: 'tool_result', tool_use_id: 'commit-1', content: '[main abc1234] Fix export',
      }]),
      message('test', 'assistant', [{
        type: 'tool_use', id: 'test-1', name: 'functions.exec_command', input: { cmd: 'pnpm test' },
      }]),
      message('test-result', 'user', [{
        type: 'tool_result', tool_use_id: 'test-1', content: 'Process exited with code 1', isError: true,
      }]),
      message('outcome', 'assistant', [{ type: 'text', text: 'Export is fixed; one unrelated test still fails.' }]),
    ];
    const data = {
      messages,
      session: {
        id: 'session', provider: 'claude', projectId: 'project', title: 'Summary',
        startTime: '', endTime: '', messageCount: messages.length, toolCallCount: 4,
        tokenUsage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreateTokens: 0 },
        cwd: '/tmp/project', model: '',
      },
    } satisfies ConversationData;

    const summary = summarizeConversation(data);

    expect(summary.goal).toMatchObject({ value: 'Fix the export flow and add tests.', evidenceMessageId: 'goal' });
    expect(summary.outcome).toMatchObject({ value: 'Export is fixed; one unrelated test still fails.', evidenceMessageId: 'outcome' });
    expect(summary.files.map(item => item.value)).toEqual([
      '/tmp/project/export.ts',
      '/tmp/project/export.test.ts',
    ]);
    expect(summary.commands.map(item => item.value)).toEqual([
      'git commit -m "Fix export"',
      'pnpm test',
    ]);
    expect(summary.commits).toHaveLength(1);
    expect(summary.commits[0]).toMatchObject({ value: '[main abc1234] Fix export', confidence: 'high' });
    expect(summary.failures).toHaveLength(1);
    expect(summary.failures[0]).toMatchObject({ evidenceMessageId: 'test-result', confidence: 'high' });
  });
});
