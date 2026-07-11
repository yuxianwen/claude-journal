'use client';

import { useState } from 'react';
import { ContentBlock } from '@/types';
import { useI18n } from '@/i18n';
import PrivacyImage from './PrivacyImage';

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
  if (toolName.endsWith('exec_command') && input.cmd) return String(input.cmd);
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

const RESULT_PREVIEW_LENGTH = 2000;

interface ToolCallBlockProps {
  block: ContentBlock & { type: 'tool_use' };
  result?: string | ContentBlock[];
}

function ToolImage({ src }: { src: string }) {
  return (
    <PrivacyImage src={src} className="max-w-full max-h-64 rounded object-contain cursor-zoom-in" />
  );
}

function resultText(result: string | ContentBlock[]): string {
  if (typeof result === 'string') return result;
  return result.map(block => {
    if (block.type === 'text') return block.text;
    if (block.type === 'image') return block.source.url
      ? `[External image: ${block.source.url}]`
      : `[Embedded image: ${block.source.media_type || 'unknown'}]`;
    return '';
  }).filter(Boolean).join('\n');
}

function previewText(text: string, showAll: boolean): string {
  if (showAll || text.length <= RESULT_PREVIEW_LENGTH) return text;
  return `${text.slice(0, RESULT_PREVIEW_LENGTH)}\n…`;
}

function ToolResultContent({ result, showAll }: { result: string | ContentBlock[]; showAll: boolean }) {
  if (typeof result === 'string') {
    const text = previewText(result, showAll);
    return <pre className="text-gray-400 text-xs whitespace-pre-wrap break-words max-h-64 overflow-y-auto">{text}</pre>;
  }
  return (
    <div className="space-y-1">
      {result.map((block, i) => {
        if (block.type === 'text') {
          const text = previewText(block.text, showAll);
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
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);

  const summary = formatInput(block.input, block.name);
  const hasResult = result !== undefined && result !== '' && (!Array.isArray(result) || result.length > 0);
  const fullResultText = hasResult ? resultText(result!) : '';
  const resultIsLong = fullResultText.length > RESULT_PREVIEW_LENGTH;

  const copyResult = async () => {
    if (!fullResultText) return;
    try {
      await navigator.clipboard.writeText(fullResultText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permissions vary by browser; leave the output visible.
    }
  };

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
              <div className="flex items-center gap-2 mb-1">
                <p className="text-gray-500 text-xs flex-1">{t('toolOutput')}</p>
                {fullResultText && (
                  <button type="button" onClick={copyResult} className="text-gray-500 hover:text-gray-300">
                    {copied ? t('toolCopied') : t('toolCopy')}
                  </button>
                )}
                {resultIsLong && (
                  <button type="button" onClick={() => setShowAll(value => !value)} className="text-blue-500 hover:text-blue-400">
                    {showAll ? t('toolShowLess') : t('toolShowAll')}
                  </button>
                )}
              </div>
              <ToolResultContent result={result!} showAll={showAll} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
