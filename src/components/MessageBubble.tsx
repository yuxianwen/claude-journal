'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, ContentBlock, TokenUsage } from '@/types';
import ToolCallBlock from './ToolCallBlock';
import { useI18n } from '@/i18n';
import { MessageFilters } from './ConversationView';
import ClaudeIcon from './ClaudeIcon';

function messageToMarkdown(message: Message, userLabel: string): string {
  const role = message.type === 'user' ? userLabel : 'Claude';
  const lines: string[] = [`**${role}**`, ''];
  for (const block of message.content) {
    if (block.type === 'text') {
      lines.push(block.text);
    } else if (block.type === 'thinking') {
      lines.push(`> 思考: ${block.thinking}`);
    } else if (block.type === 'tool_use') {
      lines.push(`\`\`\`\n[${block.name}] ${JSON.stringify(block.input)}\n\`\`\``);
    } else if (block.type === 'image') {
      lines.push('[图片]');
    }
  }
  return lines.join('\n');
}

function CopyMdButton({ message, isUser, userLabel, label, copiedLabel }: { message: Message; isUser: boolean; userLabel: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(messageToMarkdown(message, userLabel));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cls = `opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-1.5 py-0.5 rounded text-xs
    ${isUser ? 'text-blue-300 hover:text-white' : 'text-gray-500 hover:text-slate-700 dark:hover:text-gray-300'}`;

  return (
    <button onClick={handleCopy} title={label} className={cls}>
      {copied
        ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
      }
      {copied ? copiedLabel : 'MD'}
    </button>
  );
}

function CopyImgButton({ bubbleRef, isUser, label, copiedLabel }: { bubbleRef: React.RefObject<HTMLDivElement | null>; isUser: boolean; label: string; copiedLabel: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!bubbleRef.current || state === 'loading') return;
    setState('loading');
    const el = bubbleRef.current;
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(el, { pixelRatio: 2, cacheBust: true });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setState('done');
      setTimeout(() => setState('idle'), 2000);
    } catch {
      // fallback: download PNG
      try {
        const { toPng } = await import('html-to-image');
        const dataUrl = await toPng(el, { pixelRatio: 2 });
        const a = document.createElement('a');
        a.download = 'message.png';
        a.href = dataUrl;
        a.click();
      } catch (err2) {
        console.error('[IMG] fallback error:', err2);
      }
      setState('idle');
    }
  };

  const cls = `opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-1.5 py-0.5 rounded text-xs
    ${isUser ? 'text-blue-300 hover:text-white' : 'text-gray-500 hover:text-slate-700 dark:hover:text-gray-300'}`;

  return (
    <button onClick={handleCopy} title={label} className={cls}>
      {state === 'loading'
        ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        : state === 'done'
          ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
      }
      {state === 'done' ? copiedLabel : state === 'loading' ? '' : 'IMG'}
    </button>
  );
}

function TokenBadge({ usage }: { usage: TokenUsage }) {
  const total = usage.inputTokens + usage.outputTokens;
  if (total === 0) return null;
  return (
    <span className="text-xs text-gray-600 ml-2">
      ↑{(usage.inputTokens / 1000).toFixed(0)}K ↓{(usage.outputTokens / 1000).toFixed(0)}K
      {usage.cacheReadTokens > 0 && ` cache:${(usage.cacheReadTokens / 1000).toFixed(0)}K`}
    </span>
  );
}

function ThinkingBlock({ text, thinkingLabel, compressedLabel }: { text: string; thinkingLabel: string; compressedLabel: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-slate-600 dark:hover:text-gray-400 transition-colors"
      >
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span>{thinkingLabel}</span>
      </button>
      {open && (
        <div className="mt-1 pl-4 border-l-2 border-gray-700 text-xs text-gray-500 italic whitespace-pre-wrap">
          {text || compressedLabel}
        </div>
      )}
    </div>
  );
}

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-800/80 hover:bg-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
        title="关闭 (Esc)"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <img
        src={src}
        alt=""
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}

function ImageBlock({ block, isUser }: { block: ContentBlock & { type: 'image' }; isUser?: boolean }) {
  const [lightbox, setLightbox] = useState(false);
  const { source } = block;
  const src = source.type === 'base64' && source.data && source.media_type
    ? `data:${source.media_type};base64,${source.data}`
    : source.url || '';
  if (!src) return null;
  return (
    <div className="my-2">
      <img
        src={src}
        alt=""
        onClick={() => setLightbox(true)}
        className={`max-w-full max-h-96 rounded-lg object-contain cursor-zoom-in ${isUser ? 'ml-auto' : ''}`}
        loading="lazy"
      />
      {lightbox && <ImageLightbox src={src} onClose={() => setLightbox(false)} />}
    </div>
  );
}

// Detect and parse slash command XML blocks like:
// <command-name>/clear</command-name> <command-message>...</command-message> <command-args>...</command-args>
function parseSlashCommand(text: string): { name: string; args: string } | null {
  const nameMatch = text.match(/<command-name>([^<]+)<\/command-name>/);
  if (!nameMatch) return null;
  const argsMatch = text.match(/<command-args>([^<]*)<\/command-args>/);
  return { name: nameMatch[1].trim(), args: argsMatch?.[1]?.trim() || '' };
}

function SlashCommandChip({ name, args }: { name: string; args: string }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-950/50 border border-blue-700/30 text-blue-300 text-sm font-mono">
      <svg className="w-3.5 h-3.5 opacity-60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
      <span className="font-semibold">{name}</span>
      {args && <span className="text-blue-400/70 text-xs">{args}</span>}
    </div>
  );
}

// Parse local command output blocks injected by Claude Code when user runs shell commands.
// Tags: <local-command-caveat>, <local-command-stdout>, <local-command-stderr>
interface LocalCmdOutput { caveat?: string; stdout?: string; stderr?: string }
function parseLocalCmd(text: string): LocalCmdOutput | null {
  const has = (tag: string) => text.includes(`<${tag}>`);
  if (!has('local-command-stdout') && !has('local-command-stderr') && !has('local-command-caveat')) return null;
  const extract = (tag: string) => text.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.trim();
  return { caveat: extract('local-command-caveat'), stdout: extract('local-command-stdout'), stderr: extract('local-command-stderr') };
}

function LocalCmdBlock({ caveat, stdout, stderr }: LocalCmdOutput) {
  const [showCaveat, setShowCaveat] = useState(false);
  return (
    <div className="my-2 rounded-lg border border-gray-700/40 overflow-hidden text-xs">
      {caveat && (
        <button
          onClick={() => setShowCaveat(v => !v)}
          className="w-full flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/60 text-gray-500 hover:text-gray-400 transition-colors text-left"
        >
          <svg className={`w-3 h-3 transition-transform flex-shrink-0 ${showCaveat ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="italic">local command output</span>
        </button>
      )}
      {caveat && showCaveat && (
        <div className="px-3 py-1.5 bg-yellow-950/20 border-t border-gray-700/30 text-yellow-600/70 italic">{caveat}</div>
      )}
      {stdout && (
        <div className={`px-3 py-2 bg-gray-950/70 font-mono text-gray-300 whitespace-pre-wrap break-words${caveat ? ' border-t border-gray-700/30' : ''}`}>
          {stdout}
        </div>
      )}
      {stderr && (
        <div className="px-3 py-2 bg-red-950/30 border-t border-gray-700/30 font-mono text-red-400 whitespace-pre-wrap break-words">{stderr}</div>
      )}
    </div>
  );
}

function TextContent({ text, isUser }: { text: string; isUser?: boolean }) {
  return (
    <div className={`prose prose-sm max-w-none
      prose-p:my-1 prose-p:leading-relaxed
      prose-pre:bg-gray-950 prose-pre:border prose-pre:border-gray-700 prose-pre:text-xs prose-pre:overflow-x-auto prose-pre:whitespace-pre prose-pre:max-w-full
      prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
      prose-headings:font-semibold
      prose-ul:my-1 prose-li:my-0.5
      prose-blockquote:border-gray-600
      prose-table:text-xs
      ${isUser
        ? 'prose-invert prose-headings:text-gray-200 prose-strong:text-gray-200 prose-a:text-blue-300 prose-blockquote:text-gray-300 prose-code:text-green-300'
        : 'dark:prose-invert prose-a:text-blue-400 dark:prose-a:text-blue-400 dark:prose-headings:text-gray-200 dark:prose-strong:text-gray-200 dark:prose-code:text-green-300'
      }
    `}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

function renderBlock(block: ContentBlock, toolResults: Map<string, string | ContentBlock[]>, idx: number, thinkingLabel: string, compressedLabel: string, filters: MessageFilters, isUser: boolean) {
  switch (block.type) {
    case 'text': {
      if (!block.text.trim()) return null;
      const cmd = parseSlashCommand(block.text);
      if (cmd) return <SlashCommandChip key={idx} name={cmd.name} args={cmd.args} />;
      const lcmd = parseLocalCmd(block.text);
      if (lcmd) return <LocalCmdBlock key={idx} {...lcmd} />;
      return <TextContent key={idx} text={block.text} isUser={isUser} />;
    }
    case 'thinking':
      if (!filters.thinking) return null;
      return <ThinkingBlock key={idx} text={block.thinking} thinkingLabel={thinkingLabel} compressedLabel={compressedLabel} />;
    case 'tool_use':
      if (!filters.tools) return null;
      return (
        <ToolCallBlock
          key={idx}
          block={block}
          result={toolResults.get(block.id)}
        />
      );
    case 'image':
      return <ImageBlock key={idx} block={block} isUser={isUser} />;
    case 'tool_result':
      return null;
    default:
      return null;
  }
}

interface MessageBubbleProps {
  message: Message;
  nextMessage?: Message;
  filters: MessageFilters;
}

export default function MessageBubble({ message, nextMessage, filters }: MessageBubbleProps) {
  const { t } = useI18n();
  const isUser = message.type === 'user';
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Build tool result map from next message (tool_result blocks in user msg following tool_use)
  const toolResults = new Map<string, string | ContentBlock[]>();
  if (isUser) {
    for (const block of message.content) {
      if (block.type === 'tool_result') {
        toolResults.set(block.tool_use_id, block.content);
      }
    }
  }
  // Also collect tool results from the *next* user message after this assistant message
  if (!isUser && nextMessage?.type === 'user') {
    for (const block of nextMessage.content) {
      if (block.type === 'tool_result') {
        toolResults.set(block.tool_use_id, block.content);
      }
    }
  }

  // If this user message has only tool_result blocks (no text), skip rendering
  const hasOnlyToolResults = isUser && message.content.every(b => b.type === 'tool_result');
  if (hasOnlyToolResults) return null;

  const timeStr = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={`group flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <ClaudeIcon className="w-7 h-7 flex-shrink-0 mt-0.5" />
      )}

      <div className={`max-w-[85%] min-w-0 ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div
          ref={bubbleRef}
          className={`
            rounded-2xl px-4 py-2.5 break-all max-w-full overflow-x-auto
            ${isUser
              ? 'user-bubble bg-blue-600 text-white rounded-br-sm'
              : 'assistant-bubble bg-gray-800 text-gray-200 rounded-bl-sm'
            }
          `}
        >
          {message.content.map((block, idx) => renderBlock(block, toolResults, idx, t('msgThinking'), t('msgThinkingCompressed'), filters, isUser))}
        </div>

        <div className={`flex items-center gap-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-xs text-gray-600">{timeStr}</span>
          {message.usage && <TokenBadge usage={message.usage} />}
          <CopyMdButton message={message} isUser={isUser} userLabel={t('msgUser')} label={t('msgCopyMd')} copiedLabel={t('msgCopied')} />
          <CopyImgButton bubbleRef={bubbleRef} isUser={isUser} label={t('msgCopyImg')} copiedLabel={t('msgCopied')} />
        </div>
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-xs font-bold text-white">U</span>
        </div>
      )}
    </div>
  );
}
