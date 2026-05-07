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
  getSessionData: (projectId: string, sessionId: string) => Promise<ConversationData | null>;
  search: (query: string) => Promise<SearchResult[]>;
}

const FolderContext = createContext<FolderContextType | null>(null);

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

  // ── Local dev: load via API routes ─────────────────────────────────────────

  const loadFromApi = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProjects(data);
      setHasFolder(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Remote: load via File System Access API ────────────────────────────────

  const loadFromHandle = useCallback(async (handle: FileSystemDirectoryHandle) => {
    setLoading(true);
    setError('');
    try {
      const data = await getAllProjects(handle);
      setProjects(data);
      setHasFolder(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

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
    setProjects([]);
    setHasFolder(false);
    await pickFolder();
  }, [isLocal, pickFolder]);

  // ── Data access ────────────────────────────────────────────────────────────

  const getSessionData = useCallback(async (projectId: string, sessionId: string) => {
    if (isLocal) {
      const res = await fetch(`/api/sessions?projectId=${encodeURIComponent(projectId)}&sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) return null;
      return res.json();
    }
    if (!handleRef.current) return null;
    return getSession(handleRef.current, projectId, sessionId);
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
    <FolderContext.Provider value={{ projects, loading, error, hasFolder, isLocal, pickFolder, changeFolder, getSessionData, search }}>
      {children}
    </FolderContext.Provider>
  );
}
