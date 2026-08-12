'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, useSyncExternalStore } from 'react';
import { Project, ConversationData, Provider } from '@/types';
import {
  getAllProjects,
  getCodexAllProjects,
  getCodexSession,
  getSession,
  getGeminiAllProjects,
  getGeminiSession,
} from '@/lib/fs-reader';
import {
  clearHandle,
  generateSourceId,
  loadHandle,
  LOCAL_SOURCE_ID,
  saveHandle,
} from '@/lib/folder-store';
import {
  querySearchIndex,
  updateSearchIndex,
} from '@/lib/search-index';
import type { SearchResult, SearchSessionLoader } from '@/lib/search-index';

type FolderIssue = 'empty' | 'permission' | 'read' | null;

const subscribeToDirectoryPickerSupport = () => () => {};

function getDirectoryPickerSupportSnapshot() {
  return typeof window.showDirectoryPicker === 'function';
}

function getDirectoryPickerSupportServerSnapshot() {
  return false;
}

function isLocalEnv() {
  if (typeof window === 'undefined') return false;
  const { hostname } = window.location;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

interface FolderContextType {
  projects: Project[];
  loading: boolean;
  error: string;
  folderIssue: FolderIssue;
  hasFolder: boolean;
  isLocal: boolean;
  supportsDirectoryPicker: boolean;
  provider: Provider;
  assistantName: string;
  sourceId: string | null;
  setProvider: (provider: Provider) => void;
  pickFolder: (opts?: { forceNew?: boolean }) => Promise<void>;
  changeFolder: () => Promise<void>;
  reload: () => Promise<void>;
  getSessionData: (projectId: string, sessionId: string, since?: number) => Promise<ConversationData | { unchanged: true } | null>;
  search: (query: string) => Promise<SearchResult[]>;
}

const FolderContext = createContext<FolderContextType | null>(null);

// Fingerprint of the project list's render-relevant state, so periodic polling
// can skip the setState (and sidebar re-render) when nothing actually changed.
function projectsSig(ps: Project[]): string {
  return ps.map(p => `${p.id}:${p.sessions.map(s => `${s.id}@${s.endTime}#${s.messageCount}`).join(',')}`).join('|');
}

export function useFolderContext() {
  const ctx = useContext(FolderContext);
  if (!ctx) throw new Error('useFolderContext must be used inside FolderProvider');
  return ctx;
}

export function FolderProvider({ children }: { children: React.ReactNode }) {
  const handleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const folderOperationRef = useRef(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [folderIssue, setFolderIssue] = useState<FolderIssue>(null);
  const [hasFolder, setHasFolder] = useState(false);
  const [isLocal] = useState(isLocalEnv);
  const supportsDirectoryPicker = useSyncExternalStore(
    subscribeToDirectoryPickerSupport,
    getDirectoryPickerSupportSnapshot,
    getDirectoryPickerSupportServerSnapshot,
  );
  const [provider, setProviderState] = useState<Provider>(() => {
    if (typeof window === 'undefined') return 'claude';
    const p = new URLSearchParams(window.location.search).get('provider');
    if (p === 'codex' || p === 'gemini') return p;
    const stored = localStorage.getItem('claude-journal-provider');
    if (stored === 'codex' || stored === 'gemini') return stored as Provider;
    return 'claude';
  });
  const providerRef = useRef(provider);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const sourceIdRef = useRef(sourceId);
  const assistantName = provider === 'gemini' ? 'Gemini' : provider === 'codex' ? 'Codex' : 'Claude';

  const isCurrentFolderOperation = useCallback((operationId: number, targetProvider: Provider) => (
    folderOperationRef.current === operationId && providerRef.current === targetProvider
  ), []);

  // Skip a state update when a refresh produced an identical project list, so
  // periodic polling doesn't trigger needless sidebar re-renders.
  const projectsSigRef = useRef('');
  const applyProjects = useCallback((next: Project[]) => {
    const sig = projectsSig(next);
    if (sig === projectsSigRef.current) return;
    projectsSigRef.current = sig;
    setProjects(next);
  }, []);

  // ── Local dev: load via API routes ─────────────────────────────────────────

  const loadFromApi = useCallback(async (targetProvider: Provider) => {
    const operationId = ++folderOperationRef.current;
    setLoading(true);
    setError('');
    setFolderIssue(null);
    sourceIdRef.current = LOCAL_SOURCE_ID;
    setSourceId(LOCAL_SOURCE_ID);
    try {
      const res = await fetch(`/api/projects?provider=${targetProvider}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!isCurrentFolderOperation(operationId, targetProvider)) return;
      applyProjects(data);
      setHasFolder(true);
    } catch (e) {
      if (!isCurrentFolderOperation(operationId, targetProvider)) return;
      setError(String(e));
    } finally {
      if (isCurrentFolderOperation(operationId, targetProvider)) setLoading(false);
    }
  }, [applyProjects, isCurrentFolderOperation]);

  // ── Remote: load via File System Access API ────────────────────────────────

  const loadFromHandle = useCallback(async (
    handle: FileSystemDirectoryHandle,
    targetProvider: Provider,
    operationId = ++folderOperationRef.current,
  ): Promise<boolean> => {
    if (!isCurrentFolderOperation(operationId, targetProvider)) return false;
    setLoading(true);
    setError('');
    setFolderIssue(null);
    try {
      const data = targetProvider === 'gemini' ? await getGeminiAllProjects(handle) : targetProvider === 'codex'
        ? await getCodexAllProjects(handle)
        : await getAllProjects(handle);
      if (!isCurrentFolderOperation(operationId, targetProvider)) return false;
      if (data.length === 0) {
        applyProjects([]);
        setHasFolder(false);
        sourceIdRef.current = null;
        setSourceId(null);
        setFolderIssue('empty');
        return false;
      }
      applyProjects(data);
      setHasFolder(true);
      return true;
    } catch {
      if (!isCurrentFolderOperation(operationId, targetProvider)) return false;
      setFolderIssue('read');
      setHasFolder(false);
      sourceIdRef.current = null;
      setSourceId(null);
      handleRef.current = null;
      return false;
    } finally {
      if (isCurrentFolderOperation(operationId, targetProvider)) setLoading(false);
    }
  }, [applyProjects, isCurrentFolderOperation]);

  const resetProjectState = useCallback(() => {
    projectsSigRef.current = '';
    setProjects([]);
    setHasFolder(false);
    setError('');
    setFolderIssue(null);
    handleRef.current = null;
  }, []);

  const loadSavedRemoteHandle = useCallback(async (targetProvider: Provider) => {
    const operationId = ++folderOperationRef.current;
    setLoading(true);
    sourceIdRef.current = null;
    setSourceId(null);
    const saved = await loadHandle(targetProvider);
    if (!isCurrentFolderOperation(operationId, targetProvider)) return false;
    if (!saved) {
      setLoading(false);
      return false;
    }

    try {
      const perm = await saved.handle.queryPermission({ mode: 'read' });
      if (!isCurrentFolderOperation(operationId, targetProvider)) return false;
      if (perm === 'granted') {
        const loaded = await loadFromHandle(saved.handle, targetProvider, operationId);
        if (loaded) {
          handleRef.current = saved.handle;
          sourceIdRef.current = saved.sourceId;
          setSourceId(saved.sourceId);
        } else if (isCurrentFolderOperation(operationId, targetProvider)) {
          await clearHandle(targetProvider);
        }
        return loaded;
      }
      const req = await saved.handle.requestPermission({ mode: 'read' });
      if (!isCurrentFolderOperation(operationId, targetProvider)) return false;
      if (req === 'granted') {
        const loaded = await loadFromHandle(saved.handle, targetProvider, operationId);
        if (loaded) {
          handleRef.current = saved.handle;
          sourceIdRef.current = saved.sourceId;
          setSourceId(saved.sourceId);
        } else if (isCurrentFolderOperation(operationId, targetProvider)) {
          await clearHandle(targetProvider);
        }
        return loaded;
      }
    } catch {
      // A saved handle may require a new user gesture; show the picker instead.
    }

    if (isCurrentFolderOperation(operationId, targetProvider)) setLoading(false);
    return false;
  }, [isCurrentFolderOperation, loadFromHandle]);

  // ── Silent refresh (polling): update the project list without the loading
  //    flicker, and skip entirely while the tab is hidden. ──────────────────
  const refreshProjects = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    try {
      if (isLocal) {
        const res = await fetch(`/api/projects?provider=${provider}`);
        if (!res.ok) return;
        applyProjects(await res.json());
      } else if (handleRef.current) {
        applyProjects(provider === 'codex'
          ? await getCodexAllProjects(handleRef.current)
          : await getAllProjects(handleRef.current));
      }
    } catch {
      // transient read error; next tick retries
    }
  }, [isLocal, applyProjects, provider]);

  // ── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      if (isLocal) {
        void loadFromApi(provider);
      } else {
        void loadSavedRemoteHandle(provider);
      }
    });
    return () => {
      cancelled = true;
      folderOperationRef.current += 1;
    };
  }, [isLocal, loadFromApi, loadSavedRemoteHandle, provider]);

  const setProvider = useCallback((next: Provider) => {
    if (next === provider) return;
    localStorage.setItem('claude-journal-provider', next);
    providerRef.current = next;
    folderOperationRef.current += 1;
    resetProjectState();
    const nextSourceId = isLocal ? LOCAL_SOURCE_ID : null;
    sourceIdRef.current = nextSourceId;
    setSourceId(nextSourceId);
    setLoading(true);
    setProviderState(next);
  }, [isLocal, provider, resetProjectState]);

  // ── Folder picker (remote only) ────────────────────────────────────────────

  const pickFolder = useCallback(async (opts?: { forceNew?: boolean }) => {
    if (isLocal) return;
    if (!window.showDirectoryPicker) {
      setError('');
      setFolderIssue(null);
      return;
    }
    const targetProvider = providerRef.current;
    const operationId = ++folderOperationRef.current;
    const previousHandle = handleRef.current;
    const previousSourceId = sourceIdRef.current;
    const previousProjects = projects;
    const previouslyHadFolder = hasFolder;

    // Reuse the previously granted handle when we have one: this click just
    // supplied the user gesture that requestPermission() needs, so a saved
    // handle can be reconfirmed without forcing a full re-pick. Skipped when
    // the user explicitly asked to change folders (opts.forceNew).
    const saved = opts?.forceNew ? null : await loadHandle(targetProvider);
    if (!isCurrentFolderOperation(operationId, targetProvider)) return;
    if (saved) {
      try {
        const req = await saved.handle.requestPermission({ mode: 'read' });
        if (!isCurrentFolderOperation(operationId, targetProvider)) return;
        if (req === 'granted') {
          const loaded = await loadFromHandle(saved.handle, targetProvider, operationId);
          if (loaded) {
            handleRef.current = saved.handle;
            sourceIdRef.current = saved.sourceId;
            setSourceId(saved.sourceId);
            return;
          }
          if (isCurrentFolderOperation(operationId, targetProvider)) await clearHandle(targetProvider);
        }
      } catch {
        // Handle may no longer be valid (e.g. folder moved/deleted); fall
        // through to the full picker below.
      }
    }

    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      if (!isCurrentFolderOperation(operationId, targetProvider)) return;
      const loaded = await loadFromHandle(handle, targetProvider, operationId);
      if (loaded) {
        const isSameSource = Boolean(
          previousHandle && previousSourceId
          && typeof previousHandle.isSameEntry === 'function'
          && await previousHandle.isSameEntry(handle).catch(() => false),
        );
        const nextSourceId = isSameSource ? previousSourceId! : generateSourceId();
        handleRef.current = handle;
        sourceIdRef.current = nextSourceId;
        setSourceId(nextSourceId);
        try {
          await saveHandle(handle, targetProvider, nextSourceId);
        } catch {
          // The selected folder remains usable for this tab even if IndexedDB
          // cannot persist it for the next visit.
        }
      } else if (previouslyHadFolder && previousHandle && previousSourceId) {
        handleRef.current = previousHandle;
        sourceIdRef.current = previousSourceId;
        setSourceId(previousSourceId);
        applyProjects(previousProjects);
        setHasFolder(true);
        setFolderIssue(null);
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      if (!isCurrentFolderOperation(operationId, targetProvider)) return;
      setError('');
      setFolderIssue((e as Error).name === 'NotAllowedError' ? 'permission' : 'read');
    }
  }, [applyProjects, hasFolder, isCurrentFolderOperation, isLocal, loadFromHandle, projects]);

  const changeFolder = useCallback(async () => {
    if (isLocal) return;
    await pickFolder({ forceNew: true });
  }, [isLocal, pickFolder]);

  const reload = useCallback(async () => {
    const targetProvider = providerRef.current;
    if (isLocal) {
      await loadFromApi(targetProvider);
    } else if (handleRef.current) {
      await loadFromHandle(handleRef.current, targetProvider);
    }
  }, [isLocal, loadFromApi, loadFromHandle]);

  // ── Auto-refresh the project list while a folder is open ────────────────────
  useEffect(() => {
    if (!hasFolder) return;
    const id = setInterval(refreshProjects, 10_000);
    const onVisible = () => { if (document.visibilityState === 'visible') refreshProjects(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [hasFolder, refreshProjects]);

  // ── Data access ────────────────────────────────────────────────────────────

  const getSessionData = useCallback(async (projectId: string, sessionId: string, since?: number) => {
    if (isLocal) {
      const params = new URLSearchParams({ projectId, sessionId });
      params.set('provider', provider);
      if (since != null) params.set('since', String(since));
      const res = await fetch(`/api/sessions?${params.toString()}`);
      if (!res.ok) return null;
      return res.json();
    }
    if (!handleRef.current) return null;
    if (provider === 'gemini') { return getGeminiSession(handleRef.current!, projectId, sessionId, since); }
    return provider === 'codex'
      ? getCodexSession(handleRef.current, projectId, sessionId, since)
      : getSession(handleRef.current, projectId, sessionId, since);
  }, [isLocal, provider]);

  const search = useCallback(async (query: string) => {
    if (!query.trim() || !sourceId) return [];

    const operationId = folderOperationRef.current;
    const targetProvider = providerRef.current;
    const targetSourceId = sourceId;
    const targetHandle = handleRef.current;
    const targetProjects = projects;
    const isCurrentSearch = () => (
      folderOperationRef.current === operationId
      && providerRef.current === targetProvider
      && sourceIdRef.current === targetSourceId
      && (isLocal || handleRef.current === targetHandle)
    );

    const loadSession: SearchSessionLoader = async (projectId, sessionId) => {
      if (!isCurrentSearch()) return null;
      if (isLocal) {
        const params = new URLSearchParams({
          projectId,
          sessionId,
          provider: targetProvider,
        });
        const res = await fetch(`/api/sessions?${params.toString()}`);
        if (!res.ok || !isCurrentSearch()) return null;
        return res.json();
      }
      if (!targetHandle) return null;
      return targetProvider === 'codex'
        ? getCodexSession(targetHandle, projectId, sessionId)
        : getSession(targetHandle, projectId, sessionId);
    };

    try {
      const update = await updateSearchIndex({
        sourceId: targetSourceId,
        provider: targetProvider,
        projects: targetProjects,
        loadSession,
        isCurrent: isCurrentSearch,
      });
      if (update.cancelled || !isCurrentSearch()) return [];
      return await querySearchIndex(targetSourceId, targetProvider, query);
    } catch {
      return [];
    }
  }, [isLocal, projects, sourceId]);

  return (
    <FolderContext.Provider value={{ projects, loading, error, folderIssue, hasFolder, isLocal, supportsDirectoryPicker, provider, assistantName, sourceId, setProvider, pickFolder, changeFolder, reload, getSessionData, search }}>
      {children}
    </FolderContext.Provider>
  );
}
