import { NextResponse } from 'next/server';
import { getSession, getSessionMtime } from '@/lib/reader';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const sessionId = searchParams.get('sessionId');
  const since = searchParams.get('since');

  if (!projectId || !sessionId) {
    return NextResponse.json({ error: 'Missing projectId or sessionId' }, { status: 400 });
  }

  // Cheap conditional check first: if the file hasn't changed since the
  // client's last read, skip the full parse/transfer entirely.
  const mtimeMs = getSessionMtime(projectId, sessionId);
  if (mtimeMs === null) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  if (since && mtimeMs <= Number(since)) {
    return NextResponse.json({ unchanged: true, mtimeMs });
  }

  const data = getSession(projectId, sessionId);
  if (!data) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
