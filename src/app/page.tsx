'use client';

import { useState, useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useFolderContext } from '@/contexts/FolderContext';
import { useI18n } from '@/i18n';
import Sidebar from '@/components/Sidebar';
import ConversationView, { MessageFilters } from '@/components/ConversationView';
import SearchView from '@/components/SearchView';
import SettingsButton from '@/components/SettingsButton';

const subscribeToStaticBrowserValue = () => () => {};

function getIsWindowsSnapshot() {
  return navigator.userAgent.toLowerCase().includes('win');
}

function getIsWindowsServerSnapshot() {
  return false;
}

function FolderPicker() {
  const { pickFolder, error, folderIssue, supportsDirectoryPicker, provider, setProvider } = useFolderContext();
  const { t } = useI18n();
  const isWindows = useSyncExternalStore(
    subscribeToStaticBrowserValue,
    getIsWindowsSnapshot,
    getIsWindowsServerSnapshot,
  );
  const isCodex = provider === 'codex';
  const isGemini = provider === 'gemini';
  const macPath = isGemini ? '~/.gemini/antigravity-cli' : isCodex ? '~/.codex/sessions' : '~/.claude/projects';
  const winPath = isGemini ? '%USERPROFILE%\\.gemini\\antigravity-cli' : isCodex ? '%USERPROFILE%\\.codex\\sessions' : '%APPDATA%\\Claude\\projects';

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="text-5xl mb-6">📂</div>
          <h2 className="text-lg font-semibold text-gray-200 mb-2">{t('pickerTitle')}</h2>
          <p className="text-sm text-gray-500 mb-4 leading-relaxed">{t('pickerDesc')}</p>
          <div className="text-left bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6 space-y-2.5">
            <div className={`flex items-start gap-2.5 ${isWindows ? 'opacity-40' : ''}`}>
              <span className="text-base mt-0.5">🍎</span>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-1">{t('pickerMac')}</p>
                <code className="text-blue-400 bg-gray-800 px-1.5 py-0.5 rounded text-xs">{macPath}</code>
              </div>
            </div>
            <div className={`flex items-start gap-2.5 ${isWindows ? '' : 'opacity-40'}`}>
              <span className="text-base mt-0.5">🪟</span>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-1">{t('pickerWindows')}</p>
                <code className="text-blue-400 bg-gray-800 px-1.5 py-0.5 rounded text-xs">{winPath}</code>
                {provider === 'claude' && <p className="text-xs text-gray-600 mt-1"><code className="text-gray-500 text-xs">{t('pickerWindowsNote')}</code></p>}
              </div>
            </div>
          </div>
          {!supportsDirectoryPicker && (
            <div className="text-left bg-amber-950/40 border border-amber-800/60 rounded-lg p-3 mb-4" role="alert">
              <p className="text-amber-300 text-xs font-medium">{t('pickerUnsupported')}</p>
              <p className="text-amber-500 text-xs mt-1 leading-relaxed">{t('pickerUnsupportedHint')}</p>
            </div>
          )}
          <button
            onClick={pickFolder}
            disabled={!supportsDirectoryPicker}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {t('pickerButton')}
          </button>
          {folderIssue === 'empty' && <p className="text-amber-400 text-xs mt-3">{t('pickerEmpty')}</p>}
          {folderIssue === 'permission' && <p className="text-amber-400 text-xs mt-3">{t('pickerPermissionDenied')}</p>}
          {folderIssue === 'read' && <p className="text-red-400 text-xs mt-3">{t('pickerReadError')}</p>}
          {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { projects, loading, hasFolder, isLocal, provider, assistantName } = useFolderContext();
  const { t } = useI18n();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const p = new URLSearchParams(window.location.search).get('p');
      if (p) return p;
      const saved = JSON.parse(localStorage.getItem('claude-journal-selected') || 'null');
      return saved?.provider === (localStorage.getItem('claude-journal-provider') || 'claude') ? saved.projectId ?? null : null;
    } catch { return null; }
  });
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const s = new URLSearchParams(window.location.search).get('s');
      if (s) return s;
      const saved = JSON.parse(localStorage.getItem('claude-journal-selected') || 'null');
      return saved?.provider === (localStorage.getItem('claude-journal-provider') || 'claude') ? saved.sessionId ?? null : null;
    } catch { return null; }
  });
  const [highlightMessageId, setHighlightMessageId] = useState<string | undefined>(undefined);
  const [showSearch, setShowSearch] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Track previous session to distinguish "initial load" from "actual switch"
  const prevSessionRef = useRef<{ projectId: string; sessionId: string } | null>(null);

  const requestedProject = selectedProjectId
    ? projects.find(project => project.id === selectedProjectId)
    : undefined;
  const requestedSelectionExists = Boolean(
    requestedProject && selectedSessionId
    && requestedProject.sessions.some(session => session.id === selectedSessionId),
  );
  const activeProjectId = requestedSelectionExists
    ? selectedProjectId
    : projects[0]?.id ?? null;
  const activeSessionId = requestedSelectionExists
    ? selectedSessionId
    : projects[0]?.sessions[0]?.id ?? null;

  // Persist selected session to URL + localStorage.
  // Clear ?scroll only when the session actually changes (not on initial load),
  // so bookmarked URLs with a scroll param are honoured by ConversationView.
  useEffect(() => {
    if (!activeProjectId || !activeSessionId) return;
    const url = new URL(window.location.href);
    url.searchParams.set('provider', provider);
    url.searchParams.set('p', activeProjectId);
    url.searchParams.set('s', activeSessionId);
    const switched = prevSessionRef.current !== null && (
      prevSessionRef.current.projectId !== activeProjectId ||
      prevSessionRef.current.sessionId !== activeSessionId
    );
    if (switched) url.searchParams.delete('scroll');
    prevSessionRef.current = { projectId: activeProjectId, sessionId: activeSessionId };
    window.history.replaceState(null, '', url.toString());
    localStorage.setItem('claude-journal-selected', JSON.stringify({ provider, projectId: activeProjectId, sessionId: activeSessionId }));
  }, [activeProjectId, activeSessionId, provider]);

  const [filters, setFilters] = useState<MessageFilters>({ thinking: true, tools: true, userMessages: true, assistantMessages: true });
  const toggleFilter = useCallback((key: keyof MessageFilters) => {
    setFilters(f => ({ ...f, [key]: !f[key] }));
  }, []);

  const handleSelectSession = useCallback((projectId: string, sessionId: string, messageUuid?: string) => {
    setSelectedProjectId(projectId);
    setSelectedSessionId(sessionId);
    setHighlightMessageId(messageUuid);
    if (window.matchMedia('(max-width: 767px)').matches) setSidebarOpen(false);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setSidebarOpen(o => !o);
      }
      if (e.key === 'Escape') setShowSearch(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const showPicker = !loading && !hasFolder && !isLocal;

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* Collapsible sidebar wrapper */}
      {!showPicker && (
        <div className={`fixed md:relative inset-y-0 left-0 z-50 h-full w-72 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0 md:ml-0' : '-translate-x-full md:translate-x-0 md:-ml-72'}`}>
          {loading ? (
            <div className="w-72 bg-gray-900 border-r border-gray-800 h-full flex items-center justify-center">
              <div className="text-gray-600 text-xs animate-pulse">{t('convLoading')}</div>
            </div>
          ) : hasFolder ? (
            <Sidebar
              projects={projects}
              selectedProjectId={activeProjectId}
              selectedSessionId={activeSessionId}
              onSelectSession={handleSelectSession}
              onToggle={() => setSidebarOpen(false)}
            />
          ) : null}
        </div>
      )}
      {!showPicker && sidebarOpen && (
        <button
          type="button"
          aria-label={t('sidebarClose')}
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      )}

      <main className="flex-1 flex flex-col min-w-0">
        {!showPicker && (
          <div className="flex items-center justify-between px-3 py-3 border-b border-gray-800 bg-gray-900/50">
            <div className="flex items-center gap-2">
              {/* Expand button — visible only when sidebar is closed */}
              {(hasFolder || loading) && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  title={`${t('sidebarOpen')} (⌘\\)`}
                  className={`p-1.5 rounded text-gray-600 hover:text-slate-700 dark:hover:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800/40 transition-all duration-200 flex-shrink-0 ${sidebarOpen ? 'opacity-0 pointer-events-none w-0 p-0 overflow-hidden' : 'opacity-100'}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6h18M3 12h18M3 18h18" />
                  </svg>
                </button>
              )}
              <div className="text-xs text-gray-600">
                {projects.length > 0 && (
                  <span>{t('sidebarProjects', { n: projects.length })} · {t('sidebarSessions', { n: projects.reduce((a, p) => a + p.sessions.length, 0) })}</span>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-500 hover:text-slate-700 hover:border-slate-400 dark:hover:text-gray-300 dark:hover:border-gray-600 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>{t('searchButton')}</span>
              <kbd className="bg-gray-800 px-1 rounded text-gray-600">⌘K</kbd>
            </button>
          </div>
        )}

        {showPicker ? (
          <FolderPicker />
        ) : activeProjectId && activeSessionId && !loading ? (
          <ConversationView
            key={`${provider}/${activeProjectId}/${activeSessionId}`}
            projectId={activeProjectId}
            sessionId={activeSessionId}
            assistantName={assistantName}
            highlightMessageId={highlightMessageId}
            filters={filters}
            onToggleFilter={toggleFilter}
          />
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-gray-500 text-sm animate-pulse">{t('convLoading')}</div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-4">💬</div>
              <p className="text-gray-500 text-sm">{t('emptySelect')}</p>
              <p className="text-gray-700 text-xs mt-1">{t('emptySearch')}</p>
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
