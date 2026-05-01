import { NextResponse } from 'next/server';
import { getAllProjects } from '@/lib/reader';

export const dynamic = 'force-dynamic';

export function GET() {
  try {
    const projects = getAllProjects();
    return NextResponse.json(projects);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
