'use client';

import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, ContentBlock, TokenUsage } from '@/types';
import ToolCallBlock from './ToolCallBlock';
import { useI18n } from '@/i18n';

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
    ${isUser ? 'text-blue-300 hover:text-white' : 'text-gray-500 hover:text-gray-300'}`;

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
    ${isUser ? 'text-blue-300 hover:text-white' : 'text-gray-500 hover:text-gray-300'}`;

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
        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors"
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

function TextContent({ text }: { text: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none
      prose-p:my-1 prose-p:leading-relaxed
      prose-pre:bg-gray-950 prose-pre:border prose-pre:border-gray-700 prose-pre:text-xs
      prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:text-green-300
      prose-headings:text-gray-200 prose-headings:font-semibold
      prose-strong:text-gray-200
      prose-a:text-blue-400
      prose-ul:my-1 prose-li:my-0.5
      prose-blockquote:border-gray-600 prose-blockquote:text-gray-400
      prose-table:text-xs
    ">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

function renderBlock(block: ContentBlock, toolResults: Map<string, string | ContentBlock[]>, idx: number, thinkingLabel: string, compressedLabel: string) {
  switch (block.type) {
    case 'text':
      return block.text.trim() ? <TextContent key={idx} text={block.text} /> : null;
    case 'thinking':
      return <ThinkingBlock key={idx} text={block.thinking} thinkingLabel={thinkingLabel} compressedLabel={compressedLabel} />;
    case 'tool_use':
      return (
        <ToolCallBlock
          key={idx}
          block={block}
          result={toolResults.get(block.id)}
        />
      );
    case 'tool_result':
      return null; // tool results are shown inline in the tool_use block
    default:
      return null;
  }
}

interface MessageBubbleProps {
  message: Message;
  nextMessage?: Message;
}

export default function MessageBubble({ message, nextMessage }: MessageBubbleProps) {
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
        <div className="w-7 h-7 rounded-full bg-orange-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-xs font-bold text-white">C</span>
        </div>
      )}

      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div
          ref={bubbleRef}
          className={`
            rounded-2xl px-4 py-2.5
            ${isUser
              ? 'bg-blue-600 text-white rounded-br-sm'
              : 'bg-gray-800 text-gray-200 rounded-bl-sm'
            }
          `}
        >
          {message.content.map((block, idx) => renderBlock(block, toolResults, idx, t('msgThinking'), t('msgThinkingCompressed')))}
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
