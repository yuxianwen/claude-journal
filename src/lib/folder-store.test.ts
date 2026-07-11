import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import {
  generateSourceId,
  loadHandle,
  LOCAL_SOURCE_ID,
  saveHandle,
  type SourceIdCrypto,
} from './folder-store';

describe('folder source identity', () => {
  it('uses crypto.randomUUID when the browser provides it', () => {
    const randomUUID = vi.fn(() => 'cd789f29-efa7-4b4d-ae3c-7901f57af942');
    const cryptoApi: SourceIdCrypto = {
      randomUUID,
      getRandomValues: vi.fn(bytes => bytes),
    };

    expect(generateSourceId(cryptoApi)).toBe('cd789f29-efa7-4b4d-ae3c-7901f57af942');
    expect(randomUUID).toHaveBeenCalledOnce();
    expect(cryptoApi.getRandomValues).not.toHaveBeenCalled();
  });

  it('builds an RFC 4122 v4 UUID with getRandomValues as the secure fallback', () => {
    const cryptoApi: SourceIdCrypto = {
      getRandomValues: bytes => {
        bytes.fill(0);
        return bytes;
      },
    };

    expect(generateSourceId(cryptoApi)).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('falls back when a partially implemented randomUUID throws', () => {
    const cryptoApi: SourceIdCrypto = {
      randomUUID: () => { throw new Error('not implemented'); },
      getRandomValues: bytes => {
        bytes.fill(0xff);
        return bytes;
      },
    };

    expect(generateSourceId(cryptoApi)).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });

  it('uses an explicit stable identity for the local API source', () => {
    expect(LOCAL_SOURCE_ID).toBe('local-filesystem');
  });

  it('persists a caller-provided source identity with the folder handle', async () => {
    const handle = { name: 'selected-folder' } as FileSystemDirectoryHandle;

    expect(await saveHandle(handle, 'codex', 'pre-generated-source')).toBe('pre-generated-source');
    expect(await loadHandle('codex')).toEqual({
      handle,
      sourceId: 'pre-generated-source',
    });
  });
});
