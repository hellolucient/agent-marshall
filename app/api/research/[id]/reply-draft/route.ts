import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateReplyDraft, saveReplyDraft } from '@/agents/engager';
import { fetchTweetById, resolveTweetIdForLookup } from '@/agents/fetchTweet';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data: row, error } = await supabase.from('research_items').select('*').eq('id', id).single();
    if (error || !row) {
      return NextResponse.json({ error: 'Research item not found' }, { status: 404 });
    }
    if (row.source_type !== 'twitter') {
      return NextResponse.json({ error: 'Only Twitter items' }, { status: 400 });
    }
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const tweetId = resolveTweetIdForLookup(row.source_url, meta);
    if (!tweetId) {
      return NextResponse.json(
        { error: 'No tweet id in link. source_url must contain /status/123…' },
        { status: 400 }
      );
    }

    let content = (row.raw_content ?? row.summary ?? row.title ?? '').toString().trim();
    const fetchedAt = meta.fullTextFetchedAt as string | undefined;
    const recentlyFetched =
      fetchedAt && Date.now() - new Date(fetchedAt).getTime() < 3600_000 && content.length >= 30;

    let username =
      typeof meta.username === 'string' && meta.username.trim() ? meta.username.trim() : 'user';

    if (!recentlyFetched || content.length < 50) {
      const x = await fetchTweetById(tweetId);
      if (!x.ok) {
        if (!content) {
          return NextResponse.json(
            { error: `Cannot draft: X lookup failed (${x.error}) and no stored text.` },
            { status: 502 }
          );
        }
      } else {
        content = x.text;
        if (x.username) username = x.username;
        await supabase
          .from('research_items')
          .update({
            raw_content: content,
            summary: content.slice(0, 1000),
            metadata: {
              ...meta,
              tweetId,
              username,
              fullTextFetchedAt: new Date().toISOString(),
            },
          })
          .eq('id', id);
      }
    }

    if (!content) {
      return NextResponse.json({ error: 'No tweet text to reply to.' }, { status: 400 });
    }

    const draft = await generateReplyDraft({
      post_id: tweetId,
      author_handle: username,
      author_display_name: username,
      content,
      thread_context: typeof meta.twitterQuery === 'string' ? `Search: ${meta.twitterQuery}` : undefined,
    });
    if (!draft) {
      return NextResponse.json(
        { error: 'OpenAI returned no reply (too short). Check OPENAI_API_KEY; try again.' },
        { status: 422 }
      );
    }

    const draftId = await saveReplyDraft(draft, {
      research_item_id: id,
      target_tweet_url: row.source_url ?? `https://x.com/i/status/${tweetId}`,
      twitter_query: meta.twitterQuery,
    });

    const { data: verify } = await supabase.from('reply_drafts').select('id,content').eq('id', draftId).single();
    if (!verify) {
      return NextResponse.json({ error: 'Draft insert did not persist (check Supabase).' }, { status: 500 });
    }

    return NextResponse.json({
      draft_id: draftId,
      reply_to_post_id: tweetId,
      reply_to_author: username,
      preview: (verify.content ?? '').slice(0, 80),
    });
  } catch (e) {
    console.error('reply-draft', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
