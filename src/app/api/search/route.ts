import { NextResponse } from 'next/server';
import { searchSessions } from '@/lib/reader';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const results = searchSessions(query);
  return NextResponse.json(results);
}
