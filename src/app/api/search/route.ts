import { NextResponse } from 'next/server';
import { searchSessions } from '@/lib/reader';
import { searchCodexSessions } from '@/lib/codex-reader';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const provider = searchParams.get('provider') || 'claude';
  const results = provider === 'codex' ? searchCodexSessions(query) : searchSessions(query);
  return NextResponse.json(results);
}
