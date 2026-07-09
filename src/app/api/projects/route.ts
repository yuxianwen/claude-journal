import { NextResponse } from 'next/server';
import { getAllProjects } from '@/lib/reader';
import { getCodexProjects } from '@/lib/codex-reader';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  try {
    const provider = new URL(request.url).searchParams.get('provider') || 'claude';
    const projects = provider === 'codex' ? getCodexProjects() : getAllProjects();
    return NextResponse.json(projects);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
