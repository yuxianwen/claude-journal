import fs from 'fs';
import path from 'path';
import os from 'os';
import { ConversationData, Project, SessionMeta, Message, ContentBlock } from '@/types';
import { emptyUsage } from '@/lib/codex-shared';

const GEMINI_BRAIN_DIR = path.join(/* turbopackIgnore: true */ os.homedir(), '.gemini', 'antigravity-cli', 'brain');
const GEMINI_HISTORY_FILE = path.join(/* turbopackIgnore: true */ os.homedir(), '.gemini', 'antigravity-cli', 'history.jsonl');

function getSessionToWorkspaceMap(): Map<string, string> {
  const map = new Map<string, string>();
  if (!fs.existsSync(GEMINI_HISTORY_FILE)) return map;
  try {
    const lines = fs.readFileSync(GEMINI_HISTORY_FILE, 'utf-8').split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.conversationId && parsed.workspace) {
          map.set(parsed.conversationId, parsed.workspace);
        }
      } catch (e) {}
    }
  } catch (e) {}
  return map;
}

function walkSessions(): string[] {
  if (!fs.existsSync(GEMINI_BRAIN_DIR)) return [];
  const entries = fs.readdirSync(GEMINI_BRAIN_DIR, { withFileTypes: true });
  const sessions: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== 'scratch') {
      const logPath = path.join(GEMINI_BRAIN_DIR, entry.name, '.system_generated', 'logs', 'transcript.jsonl');
      if (fs.existsSync(logPath)) {
        sessions.push(entry.name);
      }
    }
  }
  return sessions;
}

function getSessionFile(sessionId: string): string {
  const normalized = path.normalize(sessionId);
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) throw new Error('Invalid session id');
  return path.join(GEMINI_BRAIN_DIR, normalized, '.system_generated', 'logs', 'transcript.jsonl');
}

export function getGeminiSessionMtime(_projectId: string, sessionId: string): number | null {
  try {
    return fs.statSync(getSessionFile(sessionId)).mtimeMs;
  } catch {
    return null;
  }
}

function parseGeminiSession(projectId: string, sessionId: string, rawData: string, mtimeMs: number): ConversationData {
  const lines = rawData.split('\n').filter(Boolean);
  const messages: Message[] = [];
  let parentUuid: string | null = null;
  
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      const isUser = parsed.source === 'USER_EXPLICIT' || parsed.type === 'USER_INPUT';
      const isModel = parsed.source === 'MODEL';
      if (!isUser && !isModel) continue; 
      
      const uuid = `${sessionId}-${parsed.step_index}`;
      const blocks: ContentBlock[] = [];
      
      if (parsed.thinking) {
        blocks.push({ type: 'thinking', thinking: parsed.thinking });
      }
      if (parsed.content) {
        let text = parsed.content;
        if (isUser) {
           const m = text.match(/<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/);
           if (m) text = m[1];
        }
        blocks.push({ type: 'text', text });
      }
      if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
        for (let i=0; i<parsed.tool_calls.length; i++) {
          const tc = parsed.tool_calls[i];
          blocks.push({
            type: 'tool_use',
            id: `call_${parsed.step_index}_${i}`,
            name: tc.name,
            input: tc.args || {}
          });
        }
      }
      
      if (blocks.length > 0) {
         messages.push({
           uuid,
           parentUuid,
           type: isUser || parsed.type === 'TOOL_RESPONSE' ? 'user' : 'assistant',
           timestamp: parsed.created_at || new Date().toISOString(),
           content: blocks,
           isSidechain: false,
         });
         parentUuid = uuid;
      }
    } catch(e) {}
  }
  
  let title = '';
  const startTime = messages[0]?.timestamp || new Date().toISOString();
  const endTime = messages[messages.length-1]?.timestamp || startTime;

  for (const msg of messages) {
    if (msg.type === 'user') {
      const textBlock = msg.content.find(b => b.type === 'text');
      if (textBlock && 'text' in textBlock && textBlock.text) {
        const cleaned = textBlock.text
          .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/gi, '')
          .replace(/<environment_context>[\s\S]*?<\/environment_context>/gi, '')
          .trim();
        if (cleaned) {
          title = cleaned.slice(0, 60) + (cleaned.length > 60 ? '...' : '');
          break;
        }
      }
    }
  }

  const sessionMeta: SessionMeta = {
    id: sessionId,
    provider: 'gemini',
    projectId: projectId,
    title: title || `Antigravity ${sessionId.substring(0, 8)}`,
    startTime,
    endTime,
    messageCount: messages.length,
    toolCallCount: messages.reduce((acc, m) => acc + m.content.filter(b => b.type === 'tool_use').length, 0),
    tokenUsage: emptyUsage(),
    cwd: GEMINI_BRAIN_DIR,
    model: 'Gemini (Antigravity)',
  };

  return { session: sessionMeta, messages, mtimeMs };
}

const geminiMetaCache = new Map<string, { mtimeMs: number; meta: SessionMeta }>();

export function getGeminiProjects(): Project[] {
  const sessions = walkSessions();
  const sessionToWorkspace = getSessionToWorkspaceMap();
  
  const byProject = new Map<string, SessionMeta[]>();
  
  for (const sessionId of sessions) {
    try {
      const file = getSessionFile(sessionId);
      const mtimeMs = fs.statSync(file).mtimeMs;
      
      const workspacePath = sessionToWorkspace.get(sessionId) || 'ungrouped';
      const projectId = workspacePath === 'ungrouped' ? 'ungrouped' : path.basename(workspacePath);
      
      let meta: SessionMeta;
      const cached = geminiMetaCache.get(file);
      if (cached && cached.mtimeMs === mtimeMs) {
        meta = cached.meta;
      } else {
        const rawData = fs.readFileSync(file, 'utf-8');
        meta = parseGeminiSession(projectId, sessionId, rawData, mtimeMs).session;
        meta.cwd = workspacePath === 'ungrouped' ? GEMINI_BRAIN_DIR : workspacePath;
        geminiMetaCache.set(file, { mtimeMs, meta });
      }
      
      if (!byProject.has(projectId)) {
        byProject.set(projectId, []);
      }
      byProject.get(projectId)!.push(meta);
    } catch(e) {}
  }

  const projects: Project[] = [];
  for (const [projectId, sessionMetas] of byProject.entries()) {
    sessionMetas.sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());
    
    projects.push({
      id: projectId,
      provider: 'gemini',
      name: projectId === 'ungrouped' ? 'Ungrouped Sessions' : projectId,
      cwd: sessionMetas[0]?.cwd || GEMINI_BRAIN_DIR,
      sessions: sessionMetas,
      totalTokens: emptyUsage()
    });
  }
  
  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

export function getGeminiConversation(projectId: string, sessionId: string): ConversationData | null {
  try {
    const filePath = getSessionFile(sessionId);
    const mtimeMs = fs.statSync(filePath).mtimeMs;
    const rawData = fs.readFileSync(filePath, 'utf-8');
    return parseGeminiSession(projectId, sessionId, rawData, mtimeMs);
  } catch (e) {
    return null;
  }
}
