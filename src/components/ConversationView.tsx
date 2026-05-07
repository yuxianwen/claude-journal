'use client';

import { useEffect, useRef, useState } from 'react';
import { ConversationData } from '@/types';
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
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
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

interface ConversationViewProps {
  projectId: string;
  sessionId: string;
}

export default function ConversationView({ projectId, sessionId }: ConversationViewProps) {
  const { t } = useI18n();
  const [data, setData] = useState<ConversationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

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

  const visibleMessages = data.messages.filter(m => !m.isSidechain);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-6 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <EditableTitle projectId={projectId} sessionId={sessionId} defaultTitle={data.session.title} editLabel={t('convEditTitle')} />
          <p className="text-xs text-gray-600 mt-0.5 truncate">{data.session.cwd}</p>
        </div>
        <CopyButton text={exportToMarkdown(data, t('msgUser'))} label={t('convCopyMarkdown')} copiedLabel={t('convCopied')} />
      </div>

      {/* Stats */}
      <StatsBar session={data.session} totalMessages={visibleMessages.length} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {visibleMessages.map((msg, idx) => (
          <MessageBubble
            key={msg.uuid || idx}
            message={msg}
            nextMessage={visibleMessages[idx + 1]}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
