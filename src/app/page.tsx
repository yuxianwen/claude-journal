'use client';

import { useEffect, useState, useCallback } from 'react';
import { Project } from '@/types';
import Sidebar from '@/components/Sidebar';
import ConversationView from '@/components/ConversationView';
import SearchView from '@/components/SearchView';

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => {
        setProjects(data);
        setLoading(false);
        if (data.length > 0 && data[0].sessions.length > 0) {
          setSelectedProjectId(data[0].id);
          setSelectedSessionId(data[0].sessions[0].id);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSelectSession = useCallback((projectId: string, sessionId: string) => {
    setSelectedProjectId(projectId);
    setSelectedSessionId(sessionId);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === 'Escape') setShowSearch(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {loading ? (
        <div className="w-72 bg-gray-900 border-r border-gray-800 flex items-center justify-center">
          <div className="text-gray-600 text-xs animate-pulse">加载中...</div>
        </div>
      ) : (
        <Sidebar
          projects={projects}
          selectedProjectId={selectedProjectId}
          selectedSessionId={selectedSessionId}
          onSelectSession={handleSelectSession}
        />
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900/50">
          <div className="text-xs text-gray-600">
            {projects.length > 0 && (
              <span>{projects.length} 个项目 · {projects.reduce((a, p) => a + p.sessions.length, 0)} 个会话</span>
            )}
          </div>
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>搜索</span>
            <kbd className="bg-gray-800 px-1 rounded text-gray-600">⌘K</kbd>
          </button>
        </div>

        {selectedProjectId && selectedSessionId ? (
          <ConversationView
            key={`${selectedProjectId}/${selectedSessionId}`}
            projectId={selectedProjectId}
            sessionId={selectedSessionId}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-4">💬</div>
              <p className="text-gray-500 text-sm">从左侧选择一个会话</p>
              <p className="text-gray-700 text-xs mt-1">或按 ⌘K 搜索</p>
            </div>
          </div>
        )}
      </main>

      {showSearch && (
        <SearchView
          onSelectSession={handleSelectSession}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
}
