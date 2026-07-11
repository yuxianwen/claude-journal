import type { ContentBlock, Message } from '@/types';

export type ToolResultValue = string | ContentBlock[];

/**
 * Collect tool outputs across the complete conversation. Result-only messages
 * may be hidden by the UI, so rendering must never depend on adjacency in the
 * filtered message list.
 */
export function collectToolResults(messages: readonly Message[]): Map<string, ToolResultValue> {
  const results = new Map<string, ToolResultValue>();

  for (const message of messages) {
    for (const block of message.content) {
      if (block.type === 'tool_result' && block.tool_use_id) {
        results.set(block.tool_use_id, block.content);
      }
    }
  }

  return results;
}
