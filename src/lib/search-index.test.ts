import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import type {
  ContentBlock,
  ConversationData,
  Project,
  SessionMeta,
} from '@/types';
import {
  querySearchIndex,
  updateSearchIndex,
} from './search-index';
import type { SearchSessionLoader } from './search-index';

function sessionMeta(
  id: string,
  endTime: string,
  changes: Partial<SessionMeta> = {},
): SessionMeta {
  return {
    id,
    provider: 'claude',
    projectId: 'project-one',
    title: `Session ${id}`,
    startTime: endTime,
    endTime,
    messageCount: 1,
    toolCallCount: 0,
    tokenUsage: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreateTokens: 0,
    },
    cwd: '/workspace/project-one',
    model: 'test-model',
    ...changes,
  };
}

function project(sessions: SessionMeta[]): Project {
  return {
    id: 'project-one',
    provider: 'claude',
    name: 'Project One',
    cwd: '/workspace/project-one',
    sessions,
    totalTokens: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreateTokens: 0,
    },
  };
}

function conversation(
  session: SessionMeta,
  content: ContentBlock[] | string,
  uuid = `message-${session.id}`,
): ConversationData {
  return {
    session,
    messages: [{
      uuid,
      parentUuid: null,
      type: 'user',
      timestamp: session.endTime,
      content: typeof content === 'string' ? [{ type: 'text', text: content }] : content,
      isSidechain: false,
    }],
  };
}

function loaderFor(
  sessions: Map<string, ConversationData>,
): SearchSessionLoader {
  return vi.fn(async (_projectId, sessionId) => sessions.get(sessionId) ?? null);
}

describe('persistent incremental search index', () => {
  it('builds every session on first use', async () => {
    const sourceId = 'search-first-build';
    const first = sessionMeta('first', '2026-01-01T00:00:00.000Z');
    const second = sessionMeta('second', '2026-01-02T00:00:00.000Z');
    const loader = loaderFor(new Map([
      [first.id, conversation(first, 'first marker')],
      [second.id, conversation(second, 'second marker')],
    ]));

    const update = await updateSearchIndex({
      sourceId,
      provider: 'claude',
      projects: [project([first, second])],
      loadSession: loader,
    });

    expect(update).toEqual({ rebuilt: 2, deleted: 0, cancelled: false });
    expect(loader).toHaveBeenCalledTimes(2);
    expect(await querySearchIndex(sourceId, 'claude', 'first marker')).toHaveLength(1);
    expect(await querySearchIndex(sourceId, 'claude', 'second marker')).toHaveLength(1);
  });

  it('does not reload sessions whose metadata signature is unchanged', async () => {
    const sourceId = 'search-unchanged';
    const session = sessionMeta('stable', '2026-02-01T00:00:00.000Z');
    const loader = loaderFor(new Map([[session.id, conversation(session, 'stable marker')]]));
    const options = {
      sourceId,
      provider: 'claude' as const,
      projects: [project([session])],
      loadSession: loader,
    };

    await updateSearchIndex(options);
    const secondUpdate = await updateSearchIndex(options);

    expect(secondUpdate).toEqual({ rebuilt: 0, deleted: 0, cancelled: false });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('rebuilds only the changed session', async () => {
    const sourceId = 'search-single-change';
    const changedBefore = sessionMeta('changed', '2026-03-01T00:00:00.000Z');
    const stable = sessionMeta('stable', '2026-03-02T00:00:00.000Z');
    const sessions = new Map([
      [changedBefore.id, conversation(changedBefore, 'old content')],
      [stable.id, conversation(stable, 'stable content')],
    ]);
    const loader = loaderFor(sessions);

    await updateSearchIndex({
      sourceId,
      provider: 'claude',
      projects: [project([changedBefore, stable])],
      loadSession: loader,
    });

    const changedAfter = sessionMeta('changed', '2026-03-01T00:00:00.000Z', {
      title: 'Renamed session',
    });
    sessions.set(changedAfter.id, conversation(changedAfter, 'new content'));
    const update = await updateSearchIndex({
      sourceId,
      provider: 'claude',
      projects: [project([changedAfter, stable])],
      loadSession: loader,
    });

    expect(update).toEqual({ rebuilt: 1, deleted: 0, cancelled: false });
    expect(loader).toHaveBeenCalledTimes(3);
    expect(loader).toHaveBeenLastCalledWith('project-one', 'changed');
    expect(await querySearchIndex(sourceId, 'claude', 'old content')).toEqual([]);
    expect(await querySearchIndex(sourceId, 'claude', 'new content')).toHaveLength(1);
  });

  it('removes indexed documents for deleted sessions', async () => {
    const sourceId = 'search-delete';
    const retained = sessionMeta('retained', '2026-04-02T00:00:00.000Z');
    const removed = sessionMeta('removed', '2026-04-01T00:00:00.000Z');
    const loader = loaderFor(new Map([
      [retained.id, conversation(retained, 'retained marker')],
      [removed.id, conversation(removed, 'removed marker')],
    ]));

    await updateSearchIndex({
      sourceId,
      provider: 'claude',
      projects: [project([retained, removed])],
      loadSession: loader,
    });
    const update = await updateSearchIndex({
      sourceId,
      provider: 'claude',
      projects: [project([retained])],
      loadSession: loader,
    });

    expect(update).toEqual({ rebuilt: 0, deleted: 1, cancelled: false });
    expect(await querySearchIndex(sourceId, 'claude', 'removed marker')).toEqual([]);
    expect(await querySearchIndex(sourceId, 'claude', 'retained marker')).toHaveLength(1);
  });

  it('matches every searchable block type and sorts sessions by recency', async () => {
    const sourceId = 'search-content-and-sort';
    const older = sessionMeta('older', '2026-05-01T00:00:00.000Z', { toolCallCount: 1 });
    const newer = sessionMeta('newer', '2026-05-02T00:00:00.000Z');
    const searchableBlocks: ContentBlock[] = [
      { type: 'text', text: 'plainMarker sharedMarker' },
      { type: 'thinking', thinking: 'thoughtMarker' },
      { type: 'tool_use', id: 'tool-one', name: 'toolNameMarker', input: { key: 'inputMarker' } },
      {
        type: 'tool_result',
        tool_use_id: 'tool-one',
        content: [{ type: 'text', text: 'resultMarker' }],
      },
    ];
    const loader = loaderFor(new Map([
      [older.id, conversation(older, searchableBlocks, 'older-message')],
      [newer.id, conversation(newer, 'sharedMarker', 'newer-message')],
    ]));

    await updateSearchIndex({
      sourceId,
      provider: 'claude',
      projects: [project([older, newer])],
      loadSession: loader,
    });

    for (const marker of [
      'plainMarker',
      'thoughtMarker',
      'toolNameMarker',
      'inputMarker',
      'resultMarker',
    ]) {
      expect(await querySearchIndex(sourceId, 'claude', marker))
        .toMatchObject([{ messageUuid: 'older-message' }]);
    }

    expect(await querySearchIndex(sourceId, 'claude', 'sharedMarker'))
      .toMatchObject([
        { session: { id: 'newer' } },
        { session: { id: 'older' } },
      ]);
  });

  it('abandons an update without writing when the source snapshot changes', async () => {
    const sourceId = 'search-cancelled';
    const session = sessionMeta('cancelled', '2026-06-01T00:00:00.000Z');
    let current = true;
    const loader: SearchSessionLoader = vi.fn(async () => {
      current = false;
      return conversation(session, 'must not be indexed');
    });

    const update = await updateSearchIndex({
      sourceId,
      provider: 'claude',
      projects: [project([session])],
      loadSession: loader,
      isCurrent: () => current,
    });

    expect(update).toEqual({ rebuilt: 0, deleted: 0, cancelled: true });
    expect(await querySearchIndex(sourceId, 'claude', 'must not be indexed')).toEqual([]);
  });
});
