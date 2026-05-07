'use client';

import { useState, useCallback, useEffect } from 'react';
import { useFolderContext } from '@/contexts/FolderContext';
import Sidebar from '@/components/Sidebar';
import ConversationView from '@/components/ConversationView';
import SearchView from '@/components/SearchView';

function FolderPicker() {
  const { pickFolder, error } = useFolderContext();

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-6">📂</div>
        <h2 className="text-lg font-semibold text-gray-200 mb-2">选择 Claude 数据目录</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          请选择 <code className="text-blue-400 bg-gray-800 px-1 py-0.5 rounded text-xs">~/.claude/projects</code> 文件夹，浏览器将直接从本地读取数据，不会上传到任何服务器。
        </p>
        <button
          onClick={pickFolder}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          选择文件夹
        </button>
        {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
      </div>
    </div>
  );
}

export default function Home() {
  const { projects, loading, hasFolder, isLocal } = useFolderContext();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (projects.length > 0 && !selectedSessionId) {
      setSelectedProjectId(projects[0].id);
      setSelectedSessionId(projects[0].sessions[0]?.id ?? null);
    }
  }, [projects, selectedSessionId]);

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

  const showPicker = !loading && !hasFolder && !isLocal;

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {loading ? (
        <div className="w-72 bg-gray-900 border-r border-gray-800 flex items-center justify-center">
          <div className="text-gray-600 text-xs animate-pulse">加载中...</div>
        </div>
      ) : hasFolder ? (
        <Sidebar
          projects={projects}
          selectedProjectId={selectedProjectId}
          selectedSessionId={selectedSessionId}
          onSelectSession={handleSelectSession}
        />
      ) : null}

      <main className="flex-1 flex flex-col min-w-0">
        {!showPicker && (
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
        )}

        {showPicker ? (
          <FolderPicker />
        ) : selectedProjectId && selectedSessionId ? (
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
