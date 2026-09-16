import type { ContentBlock, ConversationData, Message, MessageFilters } from '@/types';
import { SHARE_SCHEMA_VERSION, type SharePayload } from './share-types';
import { redactPayload } from './share-redact';

export const IMAGE_REMOVED_PLACEHOLDER = '[图片已移除]';

/**
 * Default-mask cwd to ~/…/<basename>
 */
export function maskCwd(cwd?: string): string | undefined {
  if (!cwd) return cwd;
  const normalized = cwd.replace(/\\/g, '/').replace(/\/+$/, '');
  const segments = normalized.split('/').filter(Boolean);
  const basename = segments.length > 0 ? segments[segments.length - 1] : '';
  return basename ? `~/…/${basename}` : '~/…';
}

/**
 * Filter and transform content blocks according to filters and image preferences.
 */
function processContentBlocks(
  blocks: ContentBlock[],
  filters: MessageFilters,
  includeImages: boolean,
  onImageStripped: () => void
): ContentBlock[] {
  const result: ContentBlock[] = [];

  for (const block of blocks) {
    if (block.type === 'thinking') {
      if (filters.thinking) {
        result.push(block);
      }
      continue;
    }

    if (block.type === 'tool_use') {
      if (filters.tools) {
        result.push(block);
      }
      continue;
    }

    if (block.type === 'tool_result') {
      if (!filters.tools) {
        continue;
      }
      if (Array.isArray(block.content)) {
        const nestedContent: ContentBlock[] = [];
        for (const nested of block.content) {
          if (nested.type === 'image') {
            if (!includeImages) {
              onImageStripped();
              nestedContent.push({ type: 'text', text: IMAGE_REMOVED_PLACEHOLDER });
            } else {
              nestedContent.push(nested);
            }
          } else {
            nestedContent.push(nested);
          }
        }
        result.push({ ...block, content: nestedContent });
      } else {
        result.push(block);
      }
      continue;
    }

    if (block.type === 'image') {
      if (!includeImages) {
        onImageStripped();
        result.push({ type: 'text', text: IMAGE_REMOVED_PLACEHOLDER });
      } else {
        result.push(block);
      }
      continue;
    }

    // Regular text block
    result.push(block);
  }

  return result;
}

/**
 * Build a SharePayload from ConversationData and MessageFilters.
 * Drops sidechain messages, applies filters, strips images unless requested,
 * masks cwd to ~/…/<basename>, and runs the redaction pass.
 */
export function buildSharePayload(
  data: ConversationData,
  filters: MessageFilters,
  opts?: { includeImages?: boolean }
): SharePayload {
  const includeImages = Boolean(opts?.includeImages);
  let imagesStripped = 0;
  const onImageStripped = () => {
    imagesStripped++;
  };

  const filteredMessages: Message[] = [];

  for (const message of data.messages) {
    // Drop sidechain messages
    if (message.isSidechain) continue;

    // Filter by message role
    if (message.type === 'user' && !filters.userMessages) continue;
    if (message.type === 'assistant' && !filters.assistantMessages) continue;

    const newContent = processContentBlocks(
      message.content,
      filters,
      includeImages,
      onImageStripped
    );

    // Drop message if it had content initially but all blocks were filtered out
    if (newContent.length === 0 && message.content.length > 0) {
      continue;
    }

    filteredMessages.push({
      ...message,
      content: newContent,
    });
  }

  const initialPayload: SharePayload = {
    v: SHARE_SCHEMA_VERSION,
    session: {
      title: data.session.title,
      provider: data.session.provider,
      model: data.session.model,
      startTime: data.session.startTime,
      endTime: data.session.endTime,
      cwd: maskCwd(data.session.cwd),
    },
    messages: filteredMessages,
    filters: { ...filters },
    redactions: {
      paths: 0,
      secrets: 0,
      imagesStripped,
    },
    createdAt: new Date().toISOString(),
  };

  // Run redaction pass over the payload
  const { payload: redacted, pathCount, secretCount } = redactPayload(initialPayload);

  redacted.redactions.paths = pathCount;
  redacted.redactions.secrets = secretCount;
  redacted.redactions.imagesStripped = imagesStripped;

  return redacted;
}
