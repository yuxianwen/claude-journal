'use client';

import { useState, useEffect } from 'react';
import { ContentBlock } from '@/types';
import { useI18n } from '@/i18n';

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-800/80 hover:bg-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition-colors" title="关闭 (Esc)">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
      <img src={src} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
    </div>
  );
}

const TOOL_ICONS: Record<string, string> = {
  Bash: '⚡',
  Read: '📖',
  Write: '✏️',
  Edit: '📝',
  Grep: '🔍',
  Glob: '📂',
  Agent: '🤖',
  WebFetch: '🌐',
  WebSearch: '🔎',
  TaskCreate: '📋',
  TaskUpdate: '📋',
  AskUserQuestion: '❓',
  default: '🔧',
};

function getToolIcon(name: string) {
  return TOOL_ICONS[name] || TOOL_ICONS.default;
}

function formatInput(input: Record<string, unknown>, toolName: string): string {
  if (toolName === 'Bash' && input.command) return String(input.command);
  if (toolName === 'Read' && input.file_path) return String(input.file_path);
  if (toolName === 'Write' && input.file_path) return String(input.file_path);
  if (toolName === 'Edit' && input.file_path) return String(input.file_path);
  if (toolName === 'Grep' && input.pattern) return `"${input.pattern}"${input.path ? ` in ${input.path}` : ''}`;
  if (toolName === 'Glob' && input.pattern) return String(input.pattern);
  if (toolName === 'WebFetch' && input.url) return String(input.url);
  if (toolName === 'WebSearch' && input.query) return String(input.query);
  if (toolName === 'Agent' && input.description) return String(input.description);
  return JSON.stringify(input).slice(0, 120);
}

interface ToolCallBlockProps {
  block: ContentBlock & { type: 'tool_use' };
  result?: string | ContentBlock[];
}

function ToolImage({ src }: { src: string }) {
  const [lightbox, setLightbox] = useState(false);
  return (
    <>
      <img src={src} alt="" onClick={() => setLightbox(true)} className="max-w-full max-h-64 rounded object-contain cursor-zoom-in" loading="lazy" />
      {lightbox && <ImageLightbox src={src} onClose={() => setLightbox(false)} />}
    </>
  );
}

function ToolResultContent({ result }: { result: string | ContentBlock[] }) {
  if (typeof result === 'string') {
    const text = result.length > 2000 ? result.slice(0, 2000) + '\n... (truncated)' : result;
    return <pre className="text-gray-400 text-xs whitespace-pre-wrap break-words max-h-64 overflow-y-auto">{text}</pre>;
  }
  return (
    <div className="space-y-1">
      {result.map((block, i) => {
        if (block.type === 'text') {
          const text = block.text.length > 2000 ? block.text.slice(0, 2000) + '\n... (truncated)' : block.text;
          return <pre key={i} className="text-gray-400 text-xs whitespace-pre-wrap break-words max-h-64 overflow-y-auto">{text}</pre>;
        }
        if (block.type === 'image') {
          const { source } = block;
          const src = source.type === 'base64' && source.data && source.media_type
            ? `data:${source.media_type};base64,${source.data}`
            : source.url || '';
          return src ? <ToolImage key={i} src={src} /> : null;
        }
        return null;
      })}
    </div>
  );
}

export default function ToolCallBlock({ block, result }: ToolCallBlockProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const summary = formatInput(block.input, block.name);
  const hasResult = result !== undefined && result !== '' && (!Array.isArray(result) || result.length > 0);

  return (
    <div className="my-1.5 rounded-lg border border-gray-700/50 bg-gray-900/60 overflow-hidden text-xs font-mono">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800/40 transition-colors text-left"
      >
        <span>{getToolIcon(block.name)}</span>
        <span className="text-purple-400 font-semibold">{block.name}</span>
        <span className="text-gray-500 truncate flex-1">{summary}</span>
        <svg
          className={`w-3 h-3 text-gray-600 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-gray-700/50">
          <div className="px-3 py-2 bg-gray-950/50">
            <p className="text-gray-500 text-xs mb-1">{t('toolInput')}</p>
            <pre className="text-gray-300 text-xs whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
              {JSON.stringify(block.input, null, 2)}
            </pre>
          </div>
          {hasResult && (
            <div className="px-3 py-2 border-t border-gray-700/50 bg-gray-950/30">
              <p className="text-gray-500 text-xs mb-1">{t('toolOutput')}</p>
              <ToolResultContent result={result!} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
