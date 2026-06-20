'use client';

import { useEffect, useRef, useState } from 'react';
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
  filters: MessageFilters;
  onToggleFilter: (key: keyof MessageFilters) => void;
}

// Cheap fingerprint of a conversation's render-relevant state — lets polling
// skip setState (and the re-render) when nothing actually changed.
function convSig(d: ConversationData): string {
  const last = d.messages[d.messages.length - 1];
  return `${d.messages.length}:${last?.uuid ?? ''}:${d.session.endTime}:${d.session.title}`;
}

export default function ConversationView({ projectId, sessionId, highlightMessageId, filters, onToggleFilter }: ConversationViewProps) {
  const { t } = useI18n();
  const [data, setData] = useState<ConversationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Polling state: track the file mtime + a content fingerprint so refreshes
  // are conditional, and remember whether to follow the conversation tail.
  const lastMtimeRef = useRef<number | undefined>(undefined);
  const dataSigRef = useRef('');
  const loadingRef = useRef(true);
  const didRestoreRef = useRef(false);
  const followBottomRef = useRef(false);

  const { getSessionData } = useFolderContext();

  // Initial load (and full reload on session switch).
  useEffect(() => {
    setLoading(true);
    loadingRef.current = true;
    setError('');
    lastMtimeRef.current = undefined;
    dataSigRef.current = '';
    didRestoreRef.current = false;
    getSessionData(projectId, sessionId)
      .then(d => {
        if (!d || 'unchanged' in d) { setError(t('convNotFound')); setLoading(false); loadingRef.current = false; return; }
        setData(d);
        dataSigRef.current = convSig(d);
        lastMtimeRef.current = d.mtimeMs;
        setLoading(false);
        loadingRef.current = false;
      })
      .catch(e => {
        setError(String(e));
        setLoading(false);
        loadingRef.current = false;
      });
  }, [projectId, sessionId, getSessionData, t]);

  // Auto-refresh the open conversation. The keyed message list means only new
  // bubbles mount — existing DOM is untouched (true partial refresh).
  useEffect(() => {
    const tick = async () => {
      if (loadingRef.current) return;
      if (document.visibilityState !== 'visible') return;
      const res = await getSessionData(projectId, sessionId, lastMtimeRef.current);
      if (!res || 'unchanged' in res) return;
      lastMtimeRef.current = res.mtimeMs ?? lastMtimeRef.current;
      const sig = convSig(res);
      if (sig === dataSigRef.current) return; // mtime moved but content identical
      dataSigRef.current = sig;
      // If the user is parked at the bottom, follow new messages like `tail -f`.
      const el = scrollContainerRef.current;
      followBottomRef.current = !!el && el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setData(res);
    };
    const id = setInterval(tick, 3000);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [projectId, sessionId, getSessionData]);

  // After a tail-follow update lands, pin the scroll to the new bottom.
  useEffect(() => {
    if (!followBottomRef.current) return;
    followBottomRef.current = false;
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [data]);

  // Restore scroll position from URL ?scroll= after data renders (skip if highlight target present).
  // Only honoured when URL p/s match this session — prevents stale params from a previous session.
  useEffect(() => {
    if (!data || highlightMessageId) return;
    if (didRestoreRef.current) return; // only restore on initial load, not on poll updates
    didRestoreRef.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get('p') !== projectId || params.get('s') !== sessionId) return;
    const saved = parseInt(params.get('scroll') || '0', 10);
    if (saved <= 0) return;
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = saved;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Update URL ?scroll= (debounced) + control back-to-top visibility
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !data) return;
    let saveTimer: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      const top = container.scrollTop;
      setShowBackToTop(top > 400);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const url = new URL(window.location.href);
        if (top > 0) { url.searchParams.set('scroll', String(Math.round(top))); }
        else { url.searchParams.delete('scroll'); }
        window.history.replaceState(null, '', url.toString());
      }, 150);
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => { container.removeEventListener('scroll', handleScroll); clearTimeout(saveTimer); };
  }, [data]);

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
          <FilterChip active={filters.thinking} onToggle={() => onToggleFilter('thinking')} icon="💭" label={t('filterThinking')} />
          <FilterChip active={filters.tools} onToggle={() => onToggleFilter('tools')} icon="🔧" label={t('filterTools')} />
          <span className="w-px h-3 bg-gray-700/40 dark:bg-gray-700/40 mx-0.5 flex-shrink-0" />
          <FilterChip active={filters.userMessages} onToggle={() => onToggleFilter('userMessages')} icon="👤" label={t('filterUser')} />
          <FilterChip active={filters.assistantMessages} onToggle={() => onToggleFilter('assistantMessages')} icon="🤖" label={t('filterClaude')} />
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
