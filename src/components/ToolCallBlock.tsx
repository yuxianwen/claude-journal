'use client';

import { useState } from 'react';
import { ContentBlock } from '@/types';

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

export default function ToolCallBlock({ block, result }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);

  const summary = formatInput(block.input, block.name);
  const resultText = typeof result === 'string' ? result : result ? JSON.stringify(result) : '';

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
            <p className="text-gray-500 text-xs mb-1">Input</p>
            <pre className="text-gray-300 text-xs whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
              {JSON.stringify(block.input, null, 2)}
            </pre>
          </div>
          {resultText && (
            <div className="px-3 py-2 border-t border-gray-700/50 bg-gray-950/30">
              <p className="text-gray-500 text-xs mb-1">Output</p>
              <pre className="text-gray-400 text-xs whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                {resultText.length > 2000 ? resultText.slice(0, 2000) + '\n... (truncated)' : resultText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
