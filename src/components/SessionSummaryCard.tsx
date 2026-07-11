'use client';

import { useState } from 'react';
import { useI18n } from '@/i18n';
import type { SessionSummary, SummaryEvidence } from '@/lib/session-summary';

interface SessionSummaryCardProps {
  summary: SessionSummary;
  onReveal: (messageId: string) => void;
}

function EvidenceValue({ evidence, onReveal, mono = false }: {
  evidence: SummaryEvidence;
  onReveal: (messageId: string) => void;
  mono?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onReveal(evidence.evidenceMessageId)}
      className={`block w-full text-left text-xs text-gray-400 hover:text-gray-200 leading-relaxed ${mono ? 'font-mono' : ''}`}
      title={evidence.confidence}
    >
      {evidence.value}
    </button>
  );
}

export default function SessionSummaryCard({ summary, onReveal }: SessionSummaryCardProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const detailSections = [
    { key: 'files', label: t('summaryFiles'), icon: '📝', values: summary.files, mono: true },
    { key: 'commands', label: t('summaryCommands'), icon: '⌘', values: summary.commands, mono: true },
    { key: 'failures', label: t('summaryFailures'), icon: '⚠', values: summary.failures, mono: false },
    { key: 'commits', label: t('summaryCommits'), icon: '✓', values: summary.commits, mono: true },
  ].filter(section => section.values.length > 0);

  if (!summary.goal && !summary.outcome && detailSections.length === 0) return null;

  return (
    <section className="mb-6 rounded-xl border border-blue-900/40 bg-blue-950/20 p-4" aria-label={t('summaryTitle')}>
      <div className="flex items-center gap-3">
        <h3 className="text-xs font-semibold text-blue-300 flex-1">✦ {t('summaryTitle')}</h3>
        {detailSections.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(value => !value)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            {expanded ? t('summaryCollapse') : t('summaryExpand')}
          </button>
        )}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {summary.goal && (
          <div>
            <p className="text-xs text-gray-600 mb-1">{t('summaryGoal')}</p>
            <EvidenceValue evidence={summary.goal} onReveal={onReveal} />
          </div>
        )}
        {summary.outcome && (
          <div>
            <p className="text-xs text-gray-600 mb-1">{t('summaryOutcome')}</p>
            <EvidenceValue evidence={summary.outcome} onReveal={onReveal} />
          </div>
        )}
      </div>

      {expanded && detailSections.length > 0 && (
        <div className="mt-4 grid gap-4 border-t border-blue-900/30 pt-4 md:grid-cols-2">
          {detailSections.map(section => (
            <div key={section.key}>
              <p className="text-xs text-gray-500 mb-1.5">{section.icon} {section.label}</p>
              <div className="space-y-1.5">
                {section.values.map((evidence, index) => (
                  <EvidenceValue
                    key={`${evidence.evidenceMessageId}-${index}`}
                    evidence={evidence}
                    onReveal={onReveal}
                    mono={section.mono}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
