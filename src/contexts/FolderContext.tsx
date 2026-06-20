'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Project, ConversationData } from '@/types';
import { getAllProjects, getSession, searchSessions, SearchResult } from '@/lib/fs-reader';
import { saveHandle, loadHandle, clearHandle } from '@/lib/folder-store';

function isLocalEnv() {
  if (typeof window === 'undefined') return false;
  const { hostname } = window.location;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

interface FolderContextType {
  projects: Project[];
  loading: boolean;
  error: string;
  hasFolder: boolean;
  isLocal: boolean;
  pickFolder: () => Promise<void>;
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasFolder, setHasFolder] = useState(false);
  const [isLocal] = useState(isLocalEnv);

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

  const loadFromApi = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      applyProjects(data);
      setHasFolder(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [applyProjects]);

  // ── Remote: load via File System Access API ────────────────────────────────

  const loadFromHandle = useCallback(async (handle: FileSystemDirectoryHandle) => {
    setLoading(true);
    setError('');
    try {
      const data = await getAllProjects(handle);
      applyProjects(data);
      setHasFolder(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [applyProjects]);

  // ── Silent refresh (polling): update the project list without the loading
  //    flicker, and skip entirely while the tab is hidden. ──────────────────
  const refreshProjects = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    try {
      if (isLocal) {
        const res = await fetch('/api/projects');
        if (!res.ok) return;
        applyProjects(await res.json());
      } else if (handleRef.current) {
        applyProjects(await getAllProjects(handleRef.current));
      }
    } catch {
      // transient read error; next tick retries
    }
  }, [isLocal, applyProjects]);

  // ── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isLocal) {
      loadFromApi();
      return;
    }

    async function initRemote() {
      const saved = await loadHandle();
      if (!saved) { setLoading(false); return; }

      try {
        const perm = await saved.queryPermission({ mode: 'read' });
        if (perm === 'granted') {
          handleRef.current = saved;
          await loadFromHandle(saved);
          return;
        }
        const req = await saved.requestPermission({ mode: 'read' });
        if (req === 'granted') {
          handleRef.current = saved;
          await loadFromHandle(saved);
          return;
        }
      } catch {
        // no user gesture available, fall through to show picker
      }
      setLoading(false);
    }
    initRemote();
  }, [isLocal, loadFromApi, loadFromHandle]);

  // ── Folder picker (remote only) ────────────────────────────────────────────

  const pickFolder = useCallback(async () => {
    if (isLocal) return;
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      handleRef.current = handle;
      await saveHandle(handle);
      await loadFromHandle(handle);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(String(e));
    }
  }, [isLocal, loadFromHandle]);

  const changeFolder = useCallback(async () => {
    if (isLocal) return;
    await clearHandle();
    handleRef.current = null;
    projectsSigRef.current = '';
    setProjects([]);
    setHasFolder(false);
    await pickFolder();
  }, [isLocal, pickFolder]);

  const reload = useCallback(async () => {
    if (isLocal) {
      await loadFromApi();
    } else if (handleRef.current) {
      await loadFromHandle(handleRef.current);
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
      if (since != null) params.set('since', String(since));
      const res = await fetch(`/api/sessions?${params.toString()}`);
      if (!res.ok) return null;
      return res.json();
    }
    if (!handleRef.current) return null;
    return getSession(handleRef.current, projectId, sessionId, since);
  }, [isLocal]);

  const search = useCallback(async (query: string) => {
    if (isLocal) {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) return [];
      return res.json();
    }
    if (!handleRef.current) return [];
    return searchSessions(handleRef.current, query);
  }, [isLocal]);

  return (
    <FolderContext.Provider value={{ projects, loading, error, hasFolder, isLocal, pickFolder, changeFolder, reload, getSessionData, search }}>
      {children}
    </FolderContext.Provider>
  );
}
