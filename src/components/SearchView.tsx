'use client';

import { useState, useRef } from 'react';
import { SessionMeta } from '@/types';

interface SearchResult {
  session: SessionMeta;
  projectName: string;
  excerpt: string;
}

interface SearchViewProps {
  onSelectSession: (projectId: string, sessionId: string) => void;
  onClose: () => void;
}

export default function SearchView({ onSelectSession, onClose }: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (val: string) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!val.trim()) { setResults([]); return; }

    timerRef.current = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(val)}`)
        .then(r => r.json())
        .then(data => { setResults(data); setLoading(false); })
        .catch(() => setLoading(false));
    }, 300);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center pt-24 z-50" onClick={onClose}>
      <div
        className="w-[640px] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
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
            placeholder="搜索所有会话..."
            className="flex-1 bg-transparent text-gray-200 text-sm placeholder:text-gray-600 outline-none"
          />
          <kbd className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">Esc</kbd>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading && (
            <div className="px-4 py-6 text-center text-xs text-gray-500">搜索中...</div>
          )}
          {!loading && query && results.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-gray-500">未找到结果</div>
          )}
          {results.map((r, idx) => (
            <button
              key={idx}
              onClick={() => { onSelectSession(r.session.projectId, r.session.id); onClose(); }}
              className="w-full px-4 py-3 text-left hover:bg-gray-800 transition-colors border-b border-gray-800/50"
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
            输入关键词搜索全部对话内容
          </div>
        )}
      </div>
    </div>
  );
}
