'use client';

import { useEffect, useRef, useState } from 'react';
import { ConversationData } from '@/types';
import MessageBubble from './MessageBubble';
import StatsBar from './StatsBar';

function CopyButton({ text }: { text: string }) {
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
      {copied ? '✓ 已复制' : '复制为 Markdown'}
    </button>
  );
}

function exportToMarkdown(data: ConversationData): string {
  const lines: string[] = [`# ${data.session.title}`, '', `> ${new Date(data.session.startTime).toLocaleString('zh-CN')}`, ''];
  for (const msg of data.messages) {
    const role = msg.type === 'user' ? '**用户**' : '**Claude**';
    lines.push(`## ${role}`);
    lines.push('');
    for (const block of msg.content) {
      if (block.type === 'text') lines.push(block.text);
      else if (block.type === 'tool_use') lines.push(`\`\`\`\n[工具调用: ${block.name}]\n${JSON.stringify(block.input, null, 2)}\n\`\`\``);
      else if (block.type === 'thinking') lines.push(`> 思考: ${block.thinking.slice(0, 200)}...`);
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
  const [data, setData] = useState<ConversationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`/api/sessions?projectId=${encodeURIComponent(projectId)}&sessionId=${encodeURIComponent(sessionId)}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        setError(String(e));
        setLoading(false);
      });
  }, [projectId, sessionId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500 text-sm animate-pulse">加载中...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-red-500 text-sm">{error || '加载失败'}</div>
      </div>
    );
  }

  const visibleMessages = data.messages.filter(m => !m.isSidechain);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-6 py-3 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-gray-200 leading-tight">{data.session.title}</h2>
          <p className="text-xs text-gray-600 mt-0.5">{data.session.cwd}</p>
        </div>
        <CopyButton text={exportToMarkdown(data)} />
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
