import fs from 'fs';
import path from 'path';
import os from 'os';
import { ConversationData, Project, SessionMeta } from '@/types';
import {
  addUsage,
  buildCodexMessages,
  codexMessageText,
  emptyUsage,
  parseCodexSessionMeta,
} from '@/lib/codex-shared';

const CODEX_SESSIONS_DIR = path.join(os.homedir(), '.codex', 'sessions');

function walkJsonl(dir: string, prefix = ''): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const rel = path.join(prefix, entry.name);
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkJsonl(full, rel));
    else if (entry.isFile() && entry.name.endsWith('.jsonl')) files.push(rel);
  }
  return files;
}

function getSessionFile(sessionId: string): string {
  const normalized = path.normalize(sessionId);
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
    throw new Error('Invalid session id');
  }
  return path.join(CODEX_SESSIONS_DIR, normalized);
}

const metaCache = new Map<string, { mtimeMs: number; meta: SessionMeta }>();

function getSessionMetaCached(sessionId: string, filePath: string, mtimeMs: number): SessionMeta {
  const hit = metaCache.get(filePath);
  if (hit && hit.mtimeMs === mtimeMs) return hit.meta;
  const meta = parseCodexSessionMeta(sessionId, fs.readFileSync(filePath, 'utf-8'), mtimeMs);
  metaCache.set(filePath, { mtimeMs, meta });
  return meta;
}

export function getCodexSessionMtime(_projectId: string, sessionId: string): number | null {
  try {
    return fs.statSync(getSessionFile(sessionId)).mtimeMs;
  } catch {
    return null;
  }
}

export function getCodexProjects(): Project[] {
  const sessions = walkJsonl(CODEX_SESSIONS_DIR).map(sessionId => {
    const filePath = path.join(CODEX_SESSIONS_DIR, sessionId);
    return getSessionMetaCached(sessionId, filePath, fs.statSync(filePath).mtimeMs);
  });

  const byProject = new Map<string, SessionMeta[]>();
  for (const session of sessions) {
    const existing = byProject.get(session.projectId) || [];
    existing.push(session);
    byProject.set(session.projectId, existing);
  }

  const projects: Project[] = [];
  for (const [projectId, projectSessions] of byProject) {
    projectSessions.sort((a, b) => b.endTime.localeCompare(a.endTime));
    const cwd = projectSessions[0]?.cwd || '';
    const name = cwd ? path.basename(cwd) : projectId;
    const totalTokens = projectSessions.reduce((acc, s) => addUsage(acc, s.tokenUsage), emptyUsage());
    projects.push({ id: projectId, provider: 'codex', name, cwd, sessions: projectSessions, totalTokens });
  }

  return projects.sort((a, b) => (b.sessions[0]?.endTime || '').localeCompare(a.sessions[0]?.endTime || ''));
}

export function getCodexSession(projectId: string, sessionId: string): ConversationData | null {
  let filePath: string;
  try { filePath = getSessionFile(sessionId); } catch { return null; }
  if (!fs.existsSync(filePath)) return null;

  const mtimeMs = fs.statSync(filePath).mtimeMs;
  const content = fs.readFileSync(filePath, 'utf-8');
  const session = parseCodexSessionMeta(sessionId, content, mtimeMs);
  if (projectId && session.projectId !== projectId) return null;

  return { session, messages: buildCodexMessages(content, session.endTime), mtimeMs };
}

export function searchCodexSessions(query: string): Array<{ session: SessionMeta; projectName: string; excerpt: string; messageUuid: string }> {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  const results: Array<{ session: SessionMeta; projectName: string; excerpt: string; messageUuid: string }> = [];

  for (const project of getCodexProjects()) {
    for (const session of project.sessions) {
      const data = getCodexSession(project.id, session.id);
      if (!data) continue;
      for (const message of data.messages) {
        const text = codexMessageText(message);
        const idx = text.toLowerCase().indexOf(lowerQuery);
        if (idx === -1) continue;
        const start = Math.max(0, idx - 80);
        const end = Math.min(text.length, idx + query.length + 80);
        const excerpt = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
        results.push({ session, projectName: project.name, excerpt, messageUuid: message.uuid });
        break;
      }
      if (results.length >= 50) return results;
    }
  }

  return results;
}
