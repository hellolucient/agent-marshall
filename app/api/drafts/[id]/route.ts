import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { publishDraft } from '@/agents/publisher';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data, error } = await supabase.from('draft_posts').select('*').eq('id', id).single();
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { content, thread_tweets, status } = body;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (content !== undefined) updates.content = content;
  if (thread_tweets !== undefined) updates.thread_tweets = thread_tweets;
  if (status !== undefined) {
    if (!['draft', 'approved', 'rejected', 'published'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    updates.status = status;
  }
  const { data, error } = await supabase.from('draft_posts').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  if (url.searchParams.get('action') === 'publish') {
    const result = await publishDraft(id);
    if (!result.success) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
