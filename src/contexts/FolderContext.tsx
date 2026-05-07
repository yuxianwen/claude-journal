'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Project, ConversationData } from '@/types';
import { getAllProjects, getSession, searchSessions, SearchResult } from '@/lib/fs-reader';
import { saveHandle, loadHandle, clearHandle } from '@/lib/folder-store';

interface FolderContextType {
  projects: Project[];
  loading: boolean;
  error: string;
  hasFolder: boolean;
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

  const loadProjects = useCallback(async (handle: FileSystemDirectoryHandle) => {
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

  useEffect(() => {
    async function init() {
      const saved = await loadHandle();
      if (!saved) { setLoading(false); return; }

      try {
        const perm = await saved.queryPermission({ mode: 'read' });
        if (perm === 'granted') {
          handleRef.current = saved;
          await loadProjects(saved);
          return;
        }
        const req = await saved.requestPermission({ mode: 'read' });
        if (req === 'granted') {
          handleRef.current = saved;
          await loadProjects(saved);
          return;
        }
      } catch {
        // permission unavailable (e.g. no user gesture), silently show picker
      }
      setLoading(false);
    }
    init();
  }, [loadProjects]);

  const pickFolder = useCallback(async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      handleRef.current = handle;
      await saveHandle(handle);
      await loadProjects(handle);
    } catch (e) {
      // user cancelled
      if ((e as Error).name !== 'AbortError') setError(String(e));
    }
  }, [loadProjects]);

  const changeFolder = useCallback(async () => {
    await clearHandle();
    handleRef.current = null;
    setProjects([]);
    setHasFolder(false);
    await pickFolder();
  }, [pickFolder]);

  const getSessionData = useCallback(async (projectId: string, sessionId: string) => {
    if (!handleRef.current) return null;
    return getSession(handleRef.current, projectId, sessionId);
  }, []);

  const search = useCallback(async (query: string) => {
    if (!handleRef.current) return [];
    return searchSessions(handleRef.current, query);
  }, []);

  return (
    <FolderContext.Provider value={{ projects, loading, error, hasFolder, pickFolder, changeFolder, getSessionData, search }}>
      {children}
    </FolderContext.Provider>
  );
}
