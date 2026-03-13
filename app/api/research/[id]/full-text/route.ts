import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchTweetById, resolveTweetIdForLookup } from '@/agents/fetchTweet';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data: row, error } = await supabase.from('research_items').select('*').eq('id', id).single();
  if (error || !row || row.source_type !== 'twitter') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const tweetId = resolveTweetIdForLookup(row.source_url, meta);
  if (!tweetId) {
    return NextResponse.json(
      {
        error:
          'No tweet id — need source_url like https://x.com/handle/status/1234567890. Re-run Refresh or fix row in Supabase.',
      },
      { status: 400 }
    );
  }

  const fetched = await fetchTweetById(tweetId);
  const fallback = (row.raw_content ?? row.summary ?? row.title ?? '').toString();

  if (!fetched.ok) {
    return NextResponse.json(
      {
        error: `X tweet lookup failed: ${fetched.error}`,
        tweetId,
        fallback: fallback || undefined,
      },
      { status: 502 }
    );
  }

  const { error: upErr } = await supabase
    .from('research_items')
    .update({
      raw_content: fetched.text,
      summary: fetched.text.slice(0, 1000),
      metadata: {
        ...meta,
        tweetId,
        username: fetched.username ?? meta.username,
        fullTextFetchedAt: new Date().toISOString(),
      },
    })
    .eq('id', id);
  if (upErr) {
    return NextResponse.json({ error: 'DB update failed: ' + upErr.message, text: fetched.text, tweetId }, { status: 500 });
  }

  return NextResponse.json({
    text: fetched.text,
    tweetId,
    username: fetched.username,
    chars: fetched.text.length,
  });
}
