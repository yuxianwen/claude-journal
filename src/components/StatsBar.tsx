'use client';

import { SessionMeta } from '@/types';
import { useI18n } from '@/i18n';

function fmt(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function formatDuration(start: string, end: string): string {
  if (!start || !end) return '';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return '<1m';
}

interface StatsBarProps {
  session: SessionMeta;
  totalMessages: number;
}

export default function StatsBar({ session, totalMessages }: StatsBarProps) {
  const { t } = useI18n();
  const duration = formatDuration(session.startTime, session.endTime);

  return (
    <div className="border-b border-gray-800 bg-gray-900/50 px-6 py-2 flex items-center gap-6 text-xs text-gray-500 overflow-x-auto">
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-gray-400">💬</span>
        <span>{t('statsMessages', { n: totalMessages })}</span>
      </div>
      {session.toolCallCount > 0 && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span>🔧</span>
          <span>{t('statsToolCalls', { n: session.toolCallCount })}</span>
        </div>
      )}
      {duration && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span>⏱</span>
          <span>{duration}</span>
        </div>
      )}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span>⬆</span>
        <span>{fmt(session.tokenUsage.inputTokens)} {t('statsInput')}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span>⬇</span>
        <span>{fmt(session.tokenUsage.outputTokens)} {t('statsOutput')}</span>
      </div>
      {session.tokenUsage.cacheReadTokens > 0 && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span>⚡</span>
          <span>{fmt(session.tokenUsage.cacheReadTokens)} {t('statsCacheHit')}</span>
        </div>
      )}
      {session.model && (
        <div className="flex-shrink-0 text-gray-600 ml-auto">{session.model}</div>
      )}
    </div>
  );
}
