'use client';

import { useState, useEffect, useRef } from 'react';
import { Project, Provider, SessionMeta } from '@/types';
import { useFolderContext } from '@/contexts/FolderContext';
import { useI18n } from '@/i18n';
import LangSwitcher from './LangSwitcher';
import ThemeSwitcher from './ThemeSwitcher';

const YESTERDAY: Record<string, string> = {
  'zh-CN': '昨天', ja: '昨日', ko: '어제',
  ru: 'Вчера', ar: 'أمس', hi: 'कल',
  es: 'Ayer', fr: 'Hier', de: 'Gestern', pt: 'Ontem',
};

function formatDate(iso: string, locale: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000);

  const isCJK = locale === 'zh-CN' || locale === 'ja' || locale === 'ko';
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const y = d.getFullYear();

  if (diffDays === 0) {
    return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: !isCJK });
  }

  if (diffDays === 1) {
    return YESTERDAY[locale] ?? 'Yesterday';
  }

  if (diffDays < 7) {
    return d.toLocaleDateString(locale, { weekday: 'short' });
  }

  const sameYear = y === now.getFullYear();
  if (locale === 'zh-CN' || locale === 'ja') {
    return sameYear ? `${m}月${day}日` : `${y}年${m}月${day}日`;
  }
  if (locale === 'ko') {
    return sameYear ? `${m}월 ${day}일` : `${y}년 ${m}월 ${day}일`;
  }
  return sameYear
    ? d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
    : d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
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
  onToggle: () => void;
}

export default function Sidebar({ projects, selectedProjectId, selectedSessionId, onSelectSession, onToggle }: SidebarProps) {
  const { changeFolder, reload, provider, setProvider } = useFolderContext();
  const { t, locale } = useI18n();
  const [reloading, setReloading] = useState(false);
  const [filter, setFilter] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => {
    const initial = new Set(projects.slice(0, 3).map(p => p.id));
    if (selectedProjectId) initial.add(selectedProjectId);
    return initial;
  });
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  // Scroll selected session into view whenever selection changes
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ behavior: 'instant', block: 'nearest' });
  }, [selectedProjectId, selectedSessionId]);

  const handleReload = async () => {
    setReloading(true);
    await reload();
    setReloading(false);
  };

  const toggleProject = (id: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalSessions = projects.reduce((a, p) => a + p.sessions.length, 0);

  const keyword = filter.trim().toLowerCase();
  const filteredProjects = keyword
    ? projects
        .map(p => ({
          ...p,
          sessions: p.sessions.filter(s =>
            s.title?.toLowerCase().includes(keyword) || p.name.toLowerCase().includes(keyword)
          ),
        }))
        .filter(p => p.sessions.length > 0)
    : projects;

  const visibleExpanded = keyword
    ? new Set(filteredProjects.map(p => p.id))
    : expandedProjects;

  return (
    <aside className="w-72 min-w-[18rem] bg-gray-900 border-r border-gray-800 flex flex-col h-full overflow-hidden">
      <div className="px-4 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-semibold text-gray-200 tracking-wide">AI Journal</h1>
          <div className="flex items-center gap-2">
            <select
              value={provider}
              onChange={e => setProvider(e.target.value as Provider)}
              className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-gray-300 outline-none"
              title="Data source"
            >
              <option value="claude">Claude</option>
              <option value="codex">Codex</option>
            </select>
            <ThemeSwitcher />
            <LangSwitcher />
            <button
              onClick={handleReload}
              title={t('sidebarReload')}
              disabled={reloading}
              className="text-gray-600 hover:text-gray-400 transition-colors disabled:opacity-40"
            >
              <svg className={`w-3.5 h-3.5 ${reloading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={changeFolder}
              title={t('sidebarChangeFolder')}
              className="text-gray-600 hover:text-gray-400 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </button>
            <button
              onClick={onToggle}
              title="Collapse sidebar (⌘\)"
              className="text-gray-600 hover:text-gray-400 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {keyword
            ? `${filteredProjects.length} / ${projects.length} projects · ${filteredProjects.reduce((a, p) => a + p.sessions.length, 0)} sessions`
            : `${t('sidebarProjects', { n: projects.length })} · ${t('sidebarSessions', { n: totalSessions })}`}
        </p>
      </div>

      <div className="px-3 py-2 border-b border-gray-800">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter projects / sessions…"
            className="w-full bg-gray-800 text-xs text-gray-300 placeholder-gray-600 rounded-md pl-8 pr-7 py-1.5 outline-none focus:ring-1 focus:ring-blue-500/60"
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredProjects.map(project => (
          <div key={project.id}>
            <button
              onClick={() => toggleProject(project.id)}
              className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-200/60 dark:hover:bg-gray-800 transition-colors text-left group"
            >
              <svg
                className={`w-3.5 h-3.5 text-gray-500 transition-transform flex-shrink-0 ${visibleExpanded.has(project.id) ? 'rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-300 truncate">{project.name}</p>
                <p className="text-xs text-gray-600 truncate">{t('sidebarSessionCount', { n: project.sessions.length })}</p>
              </div>
            </button>

            {visibleExpanded.has(project.id) && (
              <div className="bg-gray-950">
                {project.sessions.map((session: SessionMeta) => {
                  const isSelected = selectedProjectId === project.id && selectedSessionId === session.id;
                  return (
                    <button
                      key={session.id}
                      ref={isSelected ? selectedItemRef : undefined}
                      onClick={() => onSelectSession(project.id, session.id)}
                      className={`w-full flex items-start gap-3 px-4 py-2.5 hover:bg-slate-200/70 dark:hover:bg-gray-800/60 transition-colors text-left ${isSelected ? 'bg-blue-950/60 border-l-2 border-blue-500' : 'border-l-2 border-transparent'}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-tight truncate ${isSelected ? 'text-blue-300' : 'text-gray-400'}`}>
                          {session.title || session.id.slice(0, 8)}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-600">{formatDate(session.endTime, locale)}</span>
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
