'use client';

import { useState } from 'react';
import { Project, SessionMeta } from '@/types';
import { useFolderContext } from '@/contexts/FolderContext';

function formatDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function formatTokens(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
}

interface SidebarProps {
  projects: Project[];
  selectedProjectId: string | null;
  selectedSessionId: string | null;
  onSelectSession: (projectId: string, sessionId: string) => void;
}

export default function Sidebar({ projects, selectedProjectId, selectedSessionId, onSelectSession }: SidebarProps) {
  const { changeFolder, isLocal } = useFolderContext();
  const [reloading, setReloading] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(projects.slice(0, 3).map(p => p.id))
  );

  const toggleProject = (id: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <aside className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col h-full overflow-hidden">
      <div className="px-4 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-semibold text-gray-200 tracking-wide">Claude Journal</h1>
          {isLocal ? (
            <button
              onClick={async () => { setReloading(true); location.reload(); }}
              title="刷新"
              disabled={reloading}
              className="text-gray-600 hover:text-gray-400 transition-colors disabled:opacity-40"
            >
              <svg className={`w-3.5 h-3.5 ${reloading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          ) : (
            <button
              onClick={changeFolder}
              title="切换文件夹"
              className="text-gray-600 hover:text-gray-400 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{projects.length} 个项目 · {projects.reduce((a, p) => a + p.sessions.length, 0)} 个会话</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {projects.map(project => (
          <div key={project.id}>
            <button
              onClick={() => toggleProject(project.id)}
              className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-800 transition-colors text-left group"
            >
              <svg
                className={`w-3.5 h-3.5 text-gray-500 transition-transform flex-shrink-0 ${expandedProjects.has(project.id) ? 'rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-300 truncate">{project.name}</p>
                <p className="text-xs text-gray-600 truncate">{project.sessions.length} sessions</p>
              </div>
            </button>

            {expandedProjects.has(project.id) && (
              <div className="bg-gray-950">
                {project.sessions.map((session: SessionMeta) => {
                  const isSelected = selectedProjectId === project.id && selectedSessionId === session.id;
                  return (
                    <button
                      key={session.id}
                      onClick={() => onSelectSession(project.id, session.id)}
                      className={`w-full flex items-start gap-3 px-4 py-2.5 hover:bg-gray-800/60 transition-colors text-left ${isSelected ? 'bg-blue-950/60 border-l-2 border-blue-500' : 'border-l-2 border-transparent'}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-tight truncate ${isSelected ? 'text-blue-300' : 'text-gray-400'}`}>
                          {session.title || session.id.slice(0, 8)}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-600">{formatDate(session.endTime)}</span>
                          {session.tokenUsage.outputTokens > 0 && (
                            <span className="text-xs text-gray-700">
                              {formatTokens(session.tokenUsage.outputTokens + session.tokenUsage.inputTokens)}t
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
