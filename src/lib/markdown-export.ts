import type { ContentBlock, ConversationData, Message } from '@/types';

function codeFence(value: string, language = ''): string {
  const longestRun = Math.max(0, ...Array.from(value.matchAll(/`+/g), match => match[0].length));
  const fence = '`'.repeat(Math.max(3, longestRun + 1));
  return `${fence}${language}\n${value}\n${fence}`;
}

function imageDescription(block: Extract<ContentBlock, { type: 'image' }>): string {
  if (block.source.url) return `[External image: ${block.source.url}]`;
  const mediaType = block.source.media_type || 'unknown media type';
  return `[Embedded image: ${mediaType}]`;
}

function toolResultContent(content: string | ContentBlock[]): string[] {
  if (typeof content === 'string') return [codeFence(content, 'text')];

  const lines: string[] = [];
  for (const block of content) {
    if (block.type === 'text') lines.push(codeFence(block.text, 'text'));
    else if (block.type === 'image') lines.push(imageDescription(block));
    else if (block.type === 'thinking') lines.push(block.thinking);
    else if (block.type === 'tool_use') {
      lines.push(`Tool: ${block.name}`);
      lines.push(codeFence(JSON.stringify(block.input, null, 2), 'json'));
    } else if (block.type === 'tool_result') {
      lines.push(`Tool result: ${block.tool_use_id}`);
      lines.push(...toolResultContent(block.content));
    }
  }
  return lines;
}

export interface MarkdownExportFilters {
  thinking?: boolean;
  tools?: boolean;
  userMessages?: boolean;
  assistantMessages?: boolean;
}

function blockMarkdown(block: ContentBlock, filters?: MarkdownExportFilters): string[] {
  if (block.type === 'text') return [block.text];
  if (block.type === 'thinking') {
    if (filters?.thinking === false) return [];
    return ['<details>', '<summary>Thinking</summary>', '', block.thinking, '', '</details>'];
  }
  if (block.type === 'tool_use') {
    if (filters?.tools === false) return [];
    return [`**Tool call: ${block.name}**`, '', codeFence(JSON.stringify(block.input, null, 2), 'json')];
  }
  if (block.type === 'tool_result') {
    if (filters?.tools === false) return [];
    return [`**Tool result: ${block.tool_use_id}**`, '', ...toolResultContent(block.content)];
  }
  if (block.type === 'image') return [imageDescription(block)];
  return [];
}

function messageMarkdown(message: Message, userLabel: string, assistantName: string, filters?: MarkdownExportFilters): string[] {
  if (message.type === 'user' && filters?.userMessages === false) return [];
  if (message.type === 'assistant' && filters?.assistantMessages === false) return [];

  // Check if message has any visible content blocks when filters are applied
  let hasVisibleContent = false;
  for (const block of message.content) {
    if (block.type === 'text' || block.type === 'image') hasVisibleContent = true;
    if (block.type === 'thinking' && filters?.thinking !== false) hasVisibleContent = true;
    if (block.type === 'tool_use' && filters?.tools !== false) hasVisibleContent = true;
    if (block.type === 'tool_result' && filters?.tools !== false) hasVisibleContent = true;
  }
  
  if (!hasVisibleContent && message.content.length > 0) return [];

  const role = message.type === 'user' ? userLabel : assistantName;
  const lines = [`## ${role}`, ''];
  if (message.timestamp) lines.push(`> ${new Date(message.timestamp).toLocaleString()}`, '');
  if (message.isSidechain) lines.push('> Sidechain message', '');

  for (const block of message.content) {
    const bLines = blockMarkdown(block, filters);
    if (bLines.length > 0) lines.push(...bLines, '');
  }
  return lines;
}

/** Create a lossless textual export without embedding large base64 image data. */
export function conversationToMarkdown(
  data: ConversationData,
  userLabel: string,
  assistantName: string,
  filters?: MarkdownExportFilters,
): string {
  const lines: string[] = [`# ${data.session.title}`, ''];
  if (data.session.startTime) lines.push(`> Started: ${new Date(data.session.startTime).toLocaleString()}`);
  if (data.session.cwd) lines.push(`> Working directory: ${data.session.cwd}`);
  lines.push(`> Provider: ${data.session.provider}`);
  if (data.session.model) lines.push(`> Model: ${data.session.model}`);
  lines.push('');

  for (const message of data.messages) {
    if (message.isSidechain) continue;
    const mLines = messageMarkdown(message, userLabel, assistantName, filters);
    if (mLines.length > 0) {
      lines.push(...mLines);
    }
  }

  return lines.join('\n').trimEnd() + '\n';
}
