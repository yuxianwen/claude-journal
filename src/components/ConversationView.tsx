'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ConversationData, Message } from '@/types';
import { useFolderContext } from '@/contexts/FolderContext';
import { useI18n } from '@/i18n';
import MessageBubble from './MessageBubble';
import StatsBar from './StatsBar';

function titleKey(projectId: string, sessionId: string) {
  return `journal:title:${projectId}/${sessionId}`;
}

function EditableTitle({ projectId, sessionId, defaultTitle, editLabel }: { projectId: string; sessionId: string; defaultTitle: string; editLabel: string }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(() => {
    if (typeof window === 'undefined') return defaultTitle;
    return localStorage.getItem(titleKey(projectId, sessionId)) || defaultTitle;
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(titleKey(projectId, sessionId));
    setTitle(saved || defaultTitle);
  }, [projectId, sessionId, defaultTitle]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const save = (val: string) => {
    const trimmed = val.trim() || defaultTitle;
    setTitle(trimmed);
    if (trimmed === defaultTitle) {
      localStorage.removeItem(titleKey(projectId, sessionId));
    } else {
      localStorage.setItem(titleKey(projectId, sessionId), trimmed);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        defaultValue={title}
        onBlur={e => save(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') save(e.currentTarget.value);
          if (e.key === 'Escape') setEditing(false);
        }}
        className="text-sm font-medium text-gray-200 bg-gray-800 border border-gray-600 rounded px-2 py-0.5 outline-none focus:border-blue-500 w-full max-w-md"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group/title flex items-center gap-1.5 text-left"
      title={editLabel}
    >
      <h2 className="text-sm font-medium text-gray-200 leading-tight">{title}</h2>
      <svg className="w-3 h-3 text-gray-600 opacity-0 group-hover/title:opacity-100 transition-opacity flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </button>
  );
}

function CopyButton({ text, label, copiedLabel }: { text: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-400 hover:text-slate-800 hover:border-slate-400 dark:hover:text-gray-200 dark:hover:border-gray-600 transition-colors"
    >
      {copied ? copiedLabel : label}
    </button>
  );
}

function exportToMarkdown(data: ConversationData, userLabel: string): string {
  const lines: string[] = [`# ${data.session.title}`, '', `> ${new Date(data.session.startTime).toLocaleString()}`, ''];
  for (const msg of data.messages) {
    const role = msg.type === 'user' ? `**${userLabel}**` : '**Claude**';
    lines.push(`## ${role}`);
    lines.push('');
    for (const block of msg.content) {
      if (block.type === 'text') lines.push(block.text);
      else if (block.type === 'tool_use') lines.push(`\`\`\`\n[${block.name}]\n${JSON.stringify(block.input, null, 2)}\n\`\`\``);
      else if (block.type === 'thinking') lines.push(`> ${block.thinking.slice(0, 200)}...`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export interface MessageFilters {
  thinking: boolean;
  tools: boolean;
  userMessages: boolean;
  assistantMessages: boolean;
}

function messageHasVisibleContent(msg: Message, filters: MessageFilters): boolean {
  if (msg.type === 'user' && !filters.userMessages) return false;
  if (msg.type === 'assistant' && !filters.assistantMessages) return false;
  if (msg.content.every(b => b.type === 'tool_result')) return false;
  return msg.content.some(block => {
    if (block.type === 'tool_result') return false;
    if (block.type === 'thinking' && !filters.thinking) return false;
    if (block.type === 'tool_use' && !filters.tools) return false;
    return true;
  });
}

function FilterChip({
  active, onToggle, icon, label,
}: {
  active: boolean;
  onToggle: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-all select-none border ${
        active
          ? 'border-gray-700/50 dark:border-gray-700/50 border-slate-200 text-gray-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800/40'
          : 'border-slate-200/60 dark:border-gray-700/30 text-slate-400/50 dark:text-gray-700 line-through'
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

interface ConversationViewProps {
  projectId: string;
  sessionId: string;
  highlightMessageId?: string;
}

export default function ConversationView({ projectId, sessionId, highlightMessageId }: ConversationViewProps) {
  const { t } = useI18n();
  const [data, setData] = useState<ConversationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<MessageFilters>({ thinking: true, tools: true, userMessages: true, assistantMessages: true });
  const [showBackToTop, setShowBackToTop] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollKey = `claude-journal-scroll:${projectId}/${sessionId}`;

  const toggleFilter = useCallback((key: keyof MessageFilters) => {
    setFilters(f => ({ ...f, [key]: !f[key] }));
  }, []);

  const { getSessionData } = useFolderContext();

  useEffect(() => {
    setLoading(true);
    setError('');
    getSessionData(projectId, sessionId)
      .then(d => {
        if (!d) { setError(t('convNotFound')); setLoading(false); return; }
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        setError(String(e));
        setLoading(false);
      });
  }, [projectId, sessionId, getSessionData, t]);

  // Restore scroll position after data renders (skip if we have a highlight target)
  useEffect(() => {
    if (!data || highlightMessageId) return;
    const saved = parseInt(localStorage.getItem(scrollKey) || '0', 10);
    if (saved <= 0) return;
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = saved;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Save scroll position (debounced) + control back-to-top visibility
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !data) return;
    let saveTimer: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      const top = container.scrollTop;
      setShowBackToTop(top > 400);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => localStorage.setItem(scrollKey, String(top)), 150);
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => { container.removeEventListener('scroll', handleScroll); clearTimeout(saveTimer); };
  }, [data, scrollKey]);

  useEffect(() => {
    if (!data || !highlightMessageId) return;
    const timer = setTimeout(() => {
      const el = scrollContainerRef.current?.querySelector(`[data-message-id="${highlightMessageId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedId(highlightMessageId);
        setTimeout(() => setHighlightedId(null), 3000);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [data, highlightMessageId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500 text-sm animate-pulse">{t('convLoading')}</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-red-500 text-sm">{error || t('convNotFound')}</div>
      </div>
    );
  }

  const visibleMessages = data.messages
    .filter(m => !m.isSidechain)
    .filter(m => messageHasVisibleContent(m, filters));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-6 py-3 border-b border-gray-800 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <EditableTitle projectId={projectId} sessionId={sessionId} defaultTitle={data.session.title} editLabel={t('convEditTitle')} />
          <p className="text-xs text-gray-600 mt-0.5 truncate">{data.session.cwd}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <FilterChip active={filters.thinking} onToggle={() => toggleFilter('thinking')} icon="💭" label={t('filterThinking')} />
          <FilterChip active={filters.tools} onToggle={() => toggleFilter('tools')} icon="🔧" label={t('filterTools')} />
          <span className="w-px h-3 bg-gray-700/40 dark:bg-gray-700/40 mx-0.5 flex-shrink-0" />
          <FilterChip active={filters.userMessages} onToggle={() => toggleFilter('userMessages')} icon="👤" label={t('filterUser')} />
          <FilterChip active={filters.assistantMessages} onToggle={() => toggleFilter('assistantMessages')} icon="🤖" label={t('filterClaude')} />
        </div>
        <CopyButton text={exportToMarkdown(data, t('msgUser'))} label={t('convCopyMarkdown')} copiedLabel={t('convCopied')} />
      </div>

      {/* Stats */}
      <StatsBar session={data.session} totalMessages={visibleMessages.length} />

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-6">
        {visibleMessages.map((msg, idx) => (
          <div
            key={msg.uuid || idx}
            data-message-id={msg.uuid}
            className={highlightedId === msg.uuid ? 'rounded-xl ring-2 ring-blue-500/60 ring-offset-2 ring-offset-gray-950 transition-all duration-300' : ''}
          >
            <MessageBubble
              message={msg}
              nextMessage={visibleMessages[idx + 1]}
              filters={filters}
            />
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Back to top */}
      {showBackToTop && (
        <button
          onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          title="回到顶部"
          className="fixed bottom-6 right-6 w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-gray-200 shadow-lg flex items-center justify-center transition-all duration-200 z-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
