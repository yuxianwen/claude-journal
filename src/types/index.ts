export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreateTokens: number;
}

export interface SessionMeta {
  id: string;
  projectId: string;
  title: string;
  startTime: string;
  endTime: string;
  messageCount: number;
  toolCallCount: number;
  tokenUsage: TokenUsage;
  cwd: string;
  model: string;
}

export interface Project {
  id: string;
  name: string;
  cwd: string;
  sessions: SessionMeta[];
  totalTokens: TokenUsage;
}

export type ContentBlockType =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string | ContentBlock[] }
  | { type: 'image'; source: { type: string; url?: string; media_type?: string; data?: string } }

export type ContentBlock = ContentBlockType;

export interface Message {
  uuid: string;
  parentUuid: string | null;
  type: 'user' | 'assistant';
  timestamp: string;
  content: ContentBlock[];
  usage?: TokenUsage;
  isSidechain: boolean;
}

export interface ConversationData {
  session: SessionMeta;
  messages: Message[];
}
