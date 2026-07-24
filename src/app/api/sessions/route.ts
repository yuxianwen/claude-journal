import { NextResponse } from 'next/server';
import { getSession, getSessionMtime } from '@/lib/reader';
import { getCodexSession, getCodexSessionMtime } from '@/lib/codex-reader';
import { getGeminiConversation, getGeminiSessionMtime } from '@/lib/gemini-reader';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const sessionId = searchParams.get('sessionId');
  const since = searchParams.get('since');
  const provider = searchParams.get('provider') || 'claude';

  if (!projectId || !sessionId) {
    return NextResponse.json({ error: 'Missing projectId or sessionId' }, { status: 400 });
  }

  // Cheap conditional check first: if the file hasn't changed since the
  // client's last read, skip the full parse/transfer entirely.
  const mtimeMs = provider === 'gemini' 
    ? getGeminiSessionMtime(projectId, sessionId)
    : provider === 'codex'
    ? getCodexSessionMtime(projectId, sessionId)
    : getSessionMtime(projectId, sessionId);
  if (mtimeMs === null) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  if (since && mtimeMs <= Number(since)) {
    return NextResponse.json({ unchanged: true, mtimeMs });
  }

  const data = provider === 'gemini'
    ? getGeminiConversation(projectId, sessionId)
    : provider === 'codex'
    ? getCodexSession(projectId, sessionId)
    : getSession(projectId, sessionId);
  if (!data) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
