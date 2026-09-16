'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ConversationData, MessageFilters } from '@/types';
import { useI18n } from '@/i18n';
import { buildSharePayload } from '@/lib/share-payload';
import { buildShareHtml } from '@/lib/share-html';
import type { SharePayload } from '@/lib/share-types';

interface ShareDialogProps {
  data: ConversationData;
  assistantName: string;
  userLabel: string;
  initialFilters: MessageFilters;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FilterChip({
  active,
  onToggle,
  icon,
  label,
}: {
  active: boolean;
  onToggle: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all select-none border ${
        active
          ? 'border-gray-700/50 dark:border-gray-700/50 border-slate-200 text-gray-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800/40 font-medium'
          : 'border-slate-200/60 dark:border-gray-700/30 text-slate-400/50 dark:text-gray-600 line-through'
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function payloadToPreviewText(payload: SharePayload, userLabel: string, assistantName: string): string {
  const lines: string[] = [];
  lines.push(`# ${payload.session.title || 'Untitled'}`);
  if (payload.session.cwd) lines.push(`📁 CWD: ${payload.session.cwd}`);
  if (payload.session.model) lines.push(`🤖 Model: ${payload.session.model}`);
  lines.push('');

  for (const msg of payload.messages) {
    const role = msg.type === 'user' ? userLabel : assistantName;
    const time = msg.timestamp ? ` (${new Date(msg.timestamp).toLocaleTimeString()})` : '';
    lines.push(`=== ${role}${time} ===`);
    for (const block of msg.content) {
      if (block.type === 'text') {
        lines.push(block.text);
      } else if (block.type === 'thinking') {
        lines.push(`💭 [Thinking]\n${block.thinking}`);
      } else if (block.type === 'tool_use') {
        lines.push(`🔧 [Tool Call: ${block.name}]\n${JSON.stringify(block.input, null, 2)}`);
      } else if (block.type === 'tool_result') {
        const contentStr = typeof block.content === 'string'
          ? block.content
          : JSON.stringify(block.content, null, 2);
        lines.push(`📋 [Tool Result: ${block.tool_use_id}]\n${contentStr}`);
      } else if (block.type === 'image') {
        lines.push('[Image]');
      }
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

function HighlightedPreview({ text }: { text: string }) {
  const parts = text.split(/(\[REDACTED:(?:secret|path)\]|\[图片已移除\])/g);

  return (
    <pre className="whitespace-pre-wrap font-mono text-xs text-slate-700 dark:text-gray-300 leading-relaxed break-all select-text">
      {parts.map((part, i) => {
        if (part === '[REDACTED:secret]') {
          return (
            <mark
              key={i}
              className="bg-red-500/20 text-red-600 dark:text-red-300 px-1 py-0.5 rounded border border-red-500/30 font-semibold"
            >
              {part}
            </mark>
          );
        }
        if (part === '[REDACTED:path]') {
          return (
            <mark
              key={i}
              className="bg-amber-500/20 text-amber-600 dark:text-amber-300 px-1 py-0.5 rounded border border-amber-500/30 font-semibold"
            >
              {part}
            </mark>
          );
        }
        if (part === '[图片已移除]') {
          return (
            <mark
              key={i}
              className="bg-blue-500/20 text-blue-600 dark:text-blue-300 px-1 py-0.5 rounded border border-blue-500/30 font-semibold"
            >
              {part}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </pre>
  );
}

export default function ShareDialog({
  data,
  assistantName,
  userLabel,
  initialFilters,
  onClose,
}: ShareDialogProps) {
  const { t } = useI18n();

  // P1 defaults: thinking OFF, tools ON, images stripped (includeImages: false)
  const [filters, setFilters] = useState<MessageFilters>(() => ({
    thinking: false,
    tools: true,
    userMessages: initialFilters.userMessages ?? true,
    assistantMessages: initialFilters.assistantMessages ?? true,
  }));

  const [includeImages, setIncludeImages] = useState(false);

  // Close on Escape & disable background scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const payload = useMemo(() => {
    return buildSharePayload(data, filters, { includeImages });
  }, [data, filters, includeImages]);

  const htmlContent = useMemo(() => {
    return buildShareHtml(payload, { assistantName, userLabel });
  }, [payload, assistantName, userLabel]);

  const estimatedSizeBytes = useMemo(() => {
    return new TextEncoder().encode(htmlContent).length;
  }, [htmlContent]);

  const previewText = useMemo(() => {
    return payloadToPreviewText(payload, userLabel, assistantName);
  }, [payload, userLabel, assistantName]);

  const handleExportHtml = () => {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const rawTitle = payload.session.title || 'conversation';
    const slug = rawTitle
      .toLowerCase()
      .trim()
      .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'conversation';
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${slug}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleFilter = (key: keyof MessageFilters) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {t('shareDialogTitle')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
              {payload.session.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
            title={t('shareClose')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Disclaimer Banner */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 text-xs leading-relaxed">
            <span className="text-base flex-shrink-0">⚠️</span>
            <p>{t('shareDisclaimer')}</p>
          </div>

          {/* Filter Chips */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterChip
                active={filters.thinking}
                onToggle={() => toggleFilter('thinking')}
                icon="💭"
                label={t('filterThinking')}
              />
              <FilterChip
                active={filters.tools}
                onToggle={() => toggleFilter('tools')}
                icon="🔧"
                label={t('filterTools')}
              />
              <FilterChip
                active={filters.userMessages}
                onToggle={() => toggleFilter('userMessages')}
                icon="👤"
                label={t('filterUser')}
              />
              <FilterChip
                active={filters.assistantMessages}
                onToggle={() => toggleFilter('assistantMessages')}
                icon="🤖"
                label={assistantName}
              />
              <span className="w-px h-4 bg-slate-300 dark:bg-gray-700 mx-1 flex-shrink-0" />
              <FilterChip
                active={includeImages}
                onToggle={() => setIncludeImages((prev) => !prev)}
                icon="🖼️"
                label={t('shareIncludeImages')}
              />
            </div>
          </div>

          {/* Redaction stats summary */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-300 border border-red-500/20 font-medium">
              {t('shareRedactedSecrets', { n: payload.redactions.secrets })}
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20 font-medium">
              {t('shareRedactedPaths', { n: payload.redactions.paths })}
            </span>
            <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20 font-medium">
              {t('shareRedactedImages', { n: payload.redactions.imagesStripped })}
            </span>
          </div>

          {/* Live Preview Area */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-gray-400">
              <span className="font-medium">{t('sharePreviewTitle')}</span>
              <span>{t('shareEstimatedSize', { n: formatBytes(estimatedSizeBytes) })}</span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-gray-950 border border-slate-200 dark:border-gray-800 rounded-xl max-h-60 overflow-y-auto">
              <HighlightedPreview text={previewText} />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-gray-400">
            {t('shareEstimatedSize', { n: formatBytes(estimatedSizeBytes) })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-gray-300 hover:text-slate-800 dark:hover:text-white transition-colors"
            >
              {t('shareClose')}
            </button>
            <button
              type="button"
              onClick={handleExportHtml}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-medium rounded-lg shadow-sm transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{t('shareExportHtml')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
