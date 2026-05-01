import { NextResponse } from 'next/server';
import { getSession } from '@/lib/reader';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const sessionId = searchParams.get('sessionId');

  if (!projectId || !sessionId) {
    return NextResponse.json({ error: 'Missing projectId or sessionId' }, { status: 400 });
  }

  const data = getSession(projectId, sessionId);
  if (!data) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
