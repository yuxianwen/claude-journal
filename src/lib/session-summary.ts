import type { ContentBlock, ConversationData, Message } from '@/types';

export type EvidenceConfidence = 'high' | 'medium' | 'low';

export interface SummaryEvidence {
  value: string;
  evidenceMessageId: string;
  confidence: EvidenceConfidence;
}

export interface SessionSummary {
  goal?: SummaryEvidence;
  outcome?: SummaryEvidence;
  files: SummaryEvidence[];
  commands: SummaryEvidence[];
  failures: SummaryEvidence[];
  commits: SummaryEvidence[];
}

interface ResultEvidence {
  content: string | ContentBlock[];
  messageId: string;
  isError?: boolean;
}

function looksLikeInjectedContext(text: string): boolean {
  const value = text.trim();
  return value.startsWith('# AGENTS.md instructions')
    || value.startsWith('<environment_context>')
    || value.startsWith('<INSTRUCTIONS>')
    || value.startsWith('You are Codex,')
    || value.startsWith('You are an AI assistant')
    || value.includes('<permissions instructions>')
    || (value.includes('<cwd>') && value.includes('<shell>'));
}

function textFromBlocks(blocks: readonly ContentBlock[]): string {
  return blocks
    .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
    .map(block => block.text.trim())
    .filter(Boolean)
    .join('\n');
}

function resultText(content: string | ContentBlock[]): string {
  if (typeof content === 'string') return content;
  return content.map(block => {
    if (block.type === 'text') return block.text;
    if (block.type === 'tool_result') return resultText(block.content);
    return '';
  }).filter(Boolean).join('\n');
}

function compact(value: string, maxLength = 500): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength).trimEnd()}…`
    : normalized;
}

function toolName(name: string): string {
  return name.toLowerCase().split('.').pop() || name.toLowerCase();
}

function commandFromTool(block: Extract<ContentBlock, { type: 'tool_use' }>): string | null {
  const name = toolName(block.name);
  if (name === 'bash' && typeof block.input.command === 'string') return block.input.command;
  if (name === 'exec_command' && typeof block.input.cmd === 'string') return block.input.cmd;
  return null;
}

function pathsFromPatch(patch: string): string[] {
  const paths: string[] = [];
  for (const line of patch.split('\n')) {
    const match = line.match(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/);
    if (match?.[1]) paths.push(match[1].trim());
  }
  return paths;
}

function filesFromTool(block: Extract<ContentBlock, { type: 'tool_use' }>): string[] {
  const name = toolName(block.name);
  const directFileTools = new Set(['write', 'edit', 'multiedit', 'notebookedit']);
  if (directFileTools.has(name)) {
    const path = block.input.file_path ?? block.input.path;
    return typeof path === 'string' && path.trim() ? [path.trim()] : [];
  }
  if (name === 'apply_patch') {
    const patch = block.input.patch ?? block.input.input ?? block.input.raw;
    return typeof patch === 'string' ? pathsFromPatch(patch) : [];
  }
  return [];
}

function failedResult(result: ResultEvidence | undefined): boolean {
  if (!result) return false;
  if (result.isError === true) return true;
  const text = resultText(result.content);
  if (/\b(?:exit(?:ed)?(?: with)? code|exit_code)["':=\s]+[1-9]\d*\b/i.test(text)) return true;
  if (/\b(?:command failed|process failed|tool error|fatal error)\b/i.test(text)) return true;
  return false;
}

function firstMeaningfulLine(value: string): string {
  return value.split('\n').map(line => line.trim()).find(Boolean) || value.trim();
}

function addUnique(target: SummaryEvidence[], seen: Set<string>, evidence: SummaryEvidence) {
  const key = evidence.value.toLocaleLowerCase();
  if (!evidence.value || seen.has(key)) return;
  seen.add(key);
  target.push(evidence);
}

function collectResults(messages: readonly Message[]): Map<string, ResultEvidence> {
  const results = new Map<string, ResultEvidence>();
  for (const message of messages) {
    for (const block of message.content) {
      if (block.type !== 'tool_result' || !block.tool_use_id) continue;
      results.set(block.tool_use_id, {
        content: block.content,
        messageId: message.uuid,
        isError: block.isError,
      });
    }
  }
  return results;
}

export function summarizeConversation(data: ConversationData): SessionSummary {
  const summary: SessionSummary = { files: [], commands: [], failures: [], commits: [] };
  const results = collectResults(data.messages);
  const seenFiles = new Set<string>();
  const seenCommands = new Set<string>();
  const seenFailures = new Set<string>();
  const seenCommits = new Set<string>();

  for (const message of data.messages) {
    const text = textFromBlocks(message.content);
    if (!summary.goal && message.type === 'user' && text && !looksLikeInjectedContext(text)) {
      summary.goal = { value: compact(text), evidenceMessageId: message.uuid, confidence: 'high' };
    }
    if (message.type === 'assistant' && text && !looksLikeInjectedContext(text)) {
      summary.outcome = { value: compact(text), evidenceMessageId: message.uuid, confidence: 'medium' };
    }

    for (const block of message.content) {
      if (block.type !== 'tool_use') continue;
      const result = results.get(block.id);
      const didFail = failedResult(result);
      const command = commandFromTool(block);

      if (command) {
        addUnique(summary.commands, seenCommands, {
          value: compact(command, 300),
          evidenceMessageId: message.uuid,
          confidence: 'high',
        });
      }

      for (const file of filesFromTool(block)) {
        addUnique(summary.files, seenFiles, {
          value: file,
          evidenceMessageId: message.uuid,
          confidence: result ? (didFail ? 'low' : 'high') : 'medium',
        });
      }

      if (didFail && result) {
        addUnique(summary.failures, seenFailures, {
          value: compact(`${block.name}: ${firstMeaningfulLine(resultText(result.content))}`, 300),
          evidenceMessageId: result.messageId,
          confidence: result.isError === true ? 'high' : 'medium',
        });
      }

      if (command && /(?:^|\s)git\s+commit(?:\s|$)/.test(command) && result && !didFail) {
        const outputLine = firstMeaningfulLine(resultText(result.content));
        addUnique(summary.commits, seenCommits, {
          value: compact(outputLine || command, 300),
          evidenceMessageId: result.messageId,
          confidence: 'high',
        });
      }
    }
  }

  return summary;
}
