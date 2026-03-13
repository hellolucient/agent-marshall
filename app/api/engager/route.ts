import { NextResponse } from 'next/server';
import { runEngagerCycle } from '@/agents/engager';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export type EngagerBody = {
  discussions: Array<{
    post_id: string;
    author_handle: string;
    author_display_name?: string;
    content: string;
    thread_context?: string;
  }>;
};

export async function POST(request: Request) {
  let body: EngagerBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!Array.isArray(body.discussions) || body.discussions.length === 0) {
    return NextResponse.json({ error: 'discussions array required' }, { status: 400 });
  }
  try {
    const result = await runEngagerCycle(body.discussions);
    return NextResponse.json(result);
  } catch (e) {
    console.error('Engager failed', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
