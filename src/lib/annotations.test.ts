import { describe, expect, it } from 'vitest';
import { makeSessionKey, normalizeTags } from './annotations';

describe('annotation identity helpers', () => {
  it('normalizes tags without losing the first display spelling', () => {
    expect(normalizeTags([' Bug ', 'bug', '', 'Needs Review', 'needs review ']))
      .toEqual(['Bug', 'Needs Review']);
  });

  it('encodes every session key segment to prevent delimiter collisions', () => {
    const key = makeSessionKey('source:one', 'codex', 'project/one', 'session:one/two');

    expect(key).toBe('v1:source%3Aone:codex:project%2Fone:session%3Aone%2Ftwo');
    expect(key.split(':')).toHaveLength(5);
  });
});
