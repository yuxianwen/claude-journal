'use client';

import { useEffect, useState, useRef } from 'react';
import { SessionMeta } from '@/types';
import { useFolderContext } from '@/contexts/FolderContext';
import { useI18n } from '@/i18n';

interface SearchResult {
  session: SessionMeta;
  projectName: string;
  excerpt: string;
  messageUuid: string;
}

interface SearchViewProps {
  onSelectSession: (projectId: string, sessionId: string, messageUuid?: string) => void;
  onClose: () => void;
}

export default function SearchView({ onSelectSession, onClose }: SearchViewProps) {
  const { search } = useFolderContext();
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    requestRef.current++;
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    const requestId = ++requestRef.current;
    setSelectedIndex(0);
    if (!val.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    timerRef.current = setTimeout(() => {
      setLoading(true);
      search(val)
        .then(data => {
          if (requestRef.current !== requestId) return;
          setResults(data);
          setSelectedIndex(0);
          setLoading(false);
        })
        .catch(() => {
          if (requestRef.current === requestId) setLoading(false);
        });
    }, 300);
  };

  const selectResult = (index: number) => {
    const result = results[index];
    if (!result) return;
    onSelectSession(result.session.projectId, result.session.id, result.messageUuid || undefined);
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (results.length === 0) return;
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const next = (selectedIndex + direction + results.length) % results.length;
      setSelectedIndex(next);
      resultRefs.current[next]?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && results.length > 0) {
      event.preventDefault();
      selectResult(selectedIndex);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center px-4 pt-6 sm:pt-24 z-50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('searchPlaceholder')}
        className="w-full max-w-[640px] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            autoFocus
            value={query}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('searchPlaceholder')}
            role="combobox"
            aria-controls="search-results"
            aria-expanded={results.length > 0}
            aria-activedescendant={results[selectedIndex] ? `search-result-${selectedIndex}` : undefined}
            className="flex-1 bg-transparent text-gray-200 text-sm placeholder:text-gray-600 outline-none"
          />
          <kbd className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">Esc</kbd>
        </div>

        <div id="search-results" role="listbox" className="max-h-96 overflow-y-auto">
          {loading && (
            <div className="px-4 py-6 text-center text-xs text-gray-500">{t('searchSearching')}</div>
          )}
          {!loading && query && results.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-gray-500">{t('searchNoResults')}</div>
          )}
          {results.map((r, idx) => (
            <button
              key={idx}
              ref={element => { resultRefs.current[idx] = element; }}
              id={`search-result-${idx}`}
              role="option"
              aria-selected={selectedIndex === idx}
              onMouseEnter={() => setSelectedIndex(idx)}
              onClick={() => selectResult(idx)}
              className={`w-full px-4 py-3 text-left transition-colors border-b border-gray-800/50 ${
                selectedIndex === idx ? 'bg-slate-100 dark:bg-gray-800' : 'hover:bg-slate-100 dark:hover:bg-gray-800'
              }`}
            >
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-xs font-medium text-blue-400 truncate">{r.session.title}</span>
                <span className="text-xs text-gray-600 flex-shrink-0">{r.projectName}</span>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{r.excerpt}</p>
            </button>
          ))}
        </div>

        {!query && (
          <div className="px-4 py-4 text-xs text-gray-600 text-center">
            {t('searchHint')}
          </div>
        )}
      </div>
    </div>
  );
}
