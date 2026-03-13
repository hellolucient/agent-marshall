/**
 * Publisher Agent — Publish approved drafts to X only.
 * Post drafts: draft_posts (tweet, thread). Reply drafts: reply_drafts table.
 */

import { supabase } from '@/lib/supabase';
import type { DraftPost } from '@/lib/supabase';
import { getXReadWrite } from '@/lib/xClient';

export type PublishResult = {
  success: boolean;
  draft_id: string;
  platform_post_id?: string;
  error?: string;
};

export type ReplyDraftRow = {
  id: string;
  content: string | null;
  reply_to_post_id: string | null;
  status: string;
};

async function markPublished(
  draftId: string,
  contentPreview: string,
  platformPostId: string | null,
  metaExtra?: Record<string, unknown>
) {
  await supabase
    .from('draft_posts')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      published_post_id: platformPostId,
      updated_at: new Date().toISOString(),
      metadata: metaExtra ?? {},
    })
    .eq('id', draftId);
  await supabase.from('published_posts').insert({
    draft_post_id: draftId,
    reply_draft_id: null,
    platform: 'x',
    platform_post_id: platformPostId,
    content_preview: contentPreview.slice(0, 100),
    published_at: new Date().toISOString(),
  });
}

async function markReplyPublished(
  replyDraftId: string,
  contentPreview: string,
  platformPostId: string | null,
  metaExtra?: Record<string, unknown>
) {
  const { data: prev } = await supabase.from('reply_drafts').select('metadata').eq('id', replyDraftId).single();
  const meta = { ...(typeof prev?.metadata === 'object' && prev.metadata ? prev.metadata : {}), ...metaExtra };
  await supabase
    .from('reply_drafts')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      published_post_id: platformPostId,
      updated_at: new Date().toISOString(),
      metadata: meta,
    })
    .eq('id', replyDraftId);
  await supabase.from('published_posts').insert({
    draft_post_id: null,
    reply_draft_id: replyDraftId,
    platform: 'x',
    platform_post_id: platformPostId,
    content_preview: contentPreview.slice(0, 100),
    published_at: new Date().toISOString(),
  });
}

export async function publishTweet(draft: DraftPost): Promise<PublishResult> {
  if (draft.draft_type !== 'tweet' || !draft.content) {
    return { success: false, draft_id: draft.id, error: 'Invalid draft type or content' };
  }
  const client = getXReadWrite();
  if (!client) {
    return {
      success: false,
      draft_id: draft.id,
      error:
        'X not configured — set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET; draft stays approved until a real post succeeds.',
    };
  }
  try {
    const { data } = await client.readWrite.v2.tweet(draft.content);
    const id = data?.id;
    if (!id) return { success: false, draft_id: draft.id, error: 'X API returned no tweet id' };
    await markPublished(draft.id, draft.content, id, { posted: true });
    return { success: true, draft_id: draft.id, platform_post_id: id };
  } catch (e) {
    return { success: false, draft_id: draft.id, error: xErrorMessage(e) };
  }
}

function xErrorMessage(e: unknown): string {
  const err = e as { data?: { detail?: string; title?: string }; code?: number; message?: string };
  const detail = err?.data?.detail ?? err?.data?.title;
  const base = err?.message ?? (e instanceof Error ? e.message : String(e));
  if (detail && !base.includes(detail)) return `${base} — ${detail}`;
  return base;
}

export async function publishThread(draft: DraftPost): Promise<PublishResult> {
  if (draft.draft_type !== 'thread' || !draft.content) {
    return { success: false, draft_id: draft.id, error: 'Invalid thread draft' };
  }
  const tweets = [draft.content, ...(draft.thread_tweets ?? [])].filter(Boolean);
  const client = getXReadWrite();
  if (!client) {
    return {
      success: false,
      draft_id: draft.id,
      error:
        'X not configured — set all four X env vars; draft stays approved until posted.',
    };
  }
  try {
    let lastId: string | undefined;
    for (const text of tweets) {
      const { data } = lastId
        ? await client.readWrite.v2.tweet(text, { reply: { in_reply_to_tweet_id: lastId } })
        : await client.readWrite.v2.tweet(text);
      lastId = data?.id;
      if (!lastId) return { success: false, draft_id: draft.id, error: 'Thread post failed mid-way' };
    }
    await markPublished(draft.id, tweets[0] ?? '', lastId ?? null, { posted: true, thread_root: lastId });
    return { success: true, draft_id: draft.id, platform_post_id: lastId };
  } catch (e) {
    return { success: false, draft_id: draft.id, error: xErrorMessage(e) };
  }
}

export async function publishReplyDraft(row: ReplyDraftRow): Promise<PublishResult> {
  if (!row.content?.trim() || !row.reply_to_post_id) {
    return { success: false, draft_id: row.id, error: 'Invalid reply draft' };
  }
  const client = getXReadWrite();
  if (!client) {
    return {
      success: false,
      draft_id: row.id,
      error:
        'X not configured — set all four X env vars; draft stays approved until posted.',
    };
  }
  try {
    const { data } = await client.readWrite.v2.tweet({
      text: row.content,
      reply: { in_reply_to_tweet_id: row.reply_to_post_id },
    });
    const id = data?.id;
    if (!id) return { success: false, draft_id: row.id, error: 'X API returned no reply id' };
    await markReplyPublished(row.id, row.content, id, {
      posted: true,
      in_reply_to: row.reply_to_post_id,
    });
    return { success: true, draft_id: row.id, platform_post_id: id };
  } catch (e) {
    return { success: false, draft_id: row.id, error: xErrorMessage(e) };
  }
}

/** Quote-tweet the target (works when reply is blocked). Same draft marked published. */
export async function publishReplyDraftAsQuote(row: ReplyDraftRow): Promise<PublishResult> {
  if (!row.content?.trim() || !row.reply_to_post_id) {
    return { success: false, draft_id: row.id, error: 'Invalid reply draft' };
  }
  const client = getXReadWrite();
  if (!client) {
    return {
      success: false,
      draft_id: row.id,
      error:
        'X not configured — set all four X env vars; draft stays approved until posted.',
    };
  }
  try {
    const { data } = await client.readWrite.v2.quote(row.content.trim(), row.reply_to_post_id);
    const id = data?.id;
    if (!id) return { success: false, draft_id: row.id, error: 'X API returned no tweet id' };
    await markReplyPublished(row.id, row.content, id, {
      posted: true,
      posted_as_quote: true,
      quoted_tweet_id: row.reply_to_post_id,
    });
    return { success: true, draft_id: row.id, platform_post_id: id };
  } catch (e) {
    return { success: false, draft_id: row.id, error: xErrorMessage(e) };
  }
}

export async function publishReplyDraftAsQuoteById(replyDraftId: string): Promise<PublishResult> {
  const { data: row, error } = await supabase
    .from('reply_drafts')
    .select('id, content, reply_to_post_id, status')
    .eq('id', replyDraftId)
    .single();
  if (error || !row) {
    return { success: false, draft_id: replyDraftId, error: error?.message ?? 'Reply draft not found' };
  }
  if (row.status !== 'approved') {
    return { success: false, draft_id: replyDraftId, error: 'Approve this reply before publishing' };
  }
  return publishReplyDraftAsQuote(row as ReplyDraftRow);
}

const MAX_TWEET = 280;

/** Plain tweet + optional link. Escapes reply/quote restrictions (no threading to their post). */
export async function publishReplyDraftStandalone(row: ReplyDraftRow): Promise<PublishResult> {
  if (!row.content?.trim() || !row.reply_to_post_id) {
    return { success: false, draft_id: row.id, error: 'Invalid reply draft' };
  }
  const client = getXReadWrite();
  if (!client) {
    return {
      success: false,
      draft_id: row.id,
      error:
        'X not configured — set all four X env vars; draft stays approved until posted.',
    };
  }
  const link = `https://x.com/i/status/${row.reply_to_post_id}`;
  const body = row.content.trim();
  const sep = '\n\n';
  let text: string;
  if (body.length + sep.length + link.length <= MAX_TWEET) {
    text = body + sep + link;
  } else {
    const room = MAX_TWEET - sep.length - link.length;
    if (room < 1) {
      text = link.slice(0, MAX_TWEET);
    } else {
      text = body.slice(0, room).trimEnd() + sep + link;
    }
  }
  if (text.length > MAX_TWEET) text = text.slice(0, MAX_TWEET);
  try {
    const { data } = await client.readWrite.v2.tweet(text);
    const id = data?.id;
    if (!id) return { success: false, draft_id: row.id, error: 'X API returned no tweet id' };
    await markReplyPublished(row.id, row.content, id, {
      posted: true,
      posted_standalone: true,
      referenced_tweet_id: row.reply_to_post_id,
      referenced_url: link,
    });
    return { success: true, draft_id: row.id, platform_post_id: id };
  } catch (e) {
    return { success: false, draft_id: row.id, error: xErrorMessage(e) };
  }
}

export async function publishReplyDraftStandaloneById(replyDraftId: string): Promise<PublishResult> {
  const { data: row, error } = await supabase
    .from('reply_drafts')
    .select('id, content, reply_to_post_id, status')
    .eq('id', replyDraftId)
    .single();
  if (error || !row) {
    return { success: false, draft_id: replyDraftId, error: error?.message ?? 'Reply draft not found' };
  }
  if (row.status !== 'approved') {
    return { success: false, draft_id: replyDraftId, error: 'Approve this reply before publishing' };
  }
  return publishReplyDraftStandalone(row as ReplyDraftRow);
}

/** Publish post draft (tweet / thread only). Replies use publishReplyDraftById via /api/reply-drafts/... */
export async function publishDraft(draftId: string): Promise<PublishResult> {
  const { data: draft, error } = await supabase
    .from('draft_posts')
    .select('*')
    .eq('id', draftId)
    .single();
  if (error || !draft) {
    return { success: false, draft_id: draftId, error: error?.message ?? 'Draft not found' };
  }
  if (draft.status !== 'approved') {
    return { success: false, draft_id: draftId, error: 'Draft must be approved before publishing' };
  }
  if (draft.draft_type === 'substack_outline') {
    return { success: false, draft_id: draftId, error: 'Substack is draft-only; publish manually' };
  }
  if (draft.draft_type === 'reply') {
    return {
      success: false,
      draft_id: draftId,
      error: 'Reply drafts live on Reply drafts page — use that Publish button.',
    };
  }
  const d = draft as unknown as DraftPost;
  if (d.draft_type === 'tweet') return publishTweet(d);
  if (d.draft_type === 'thread') return publishThread(d);
  return { success: false, draft_id: draftId, error: 'Unknown draft type' };
}

export async function publishReplyDraftById(replyDraftId: string): Promise<PublishResult> {
  const { data: row, error } = await supabase
    .from('reply_drafts')
    .select('id, content, reply_to_post_id, status')
    .eq('id', replyDraftId)
    .single();
  if (error || !row) {
    return { success: false, draft_id: replyDraftId, error: error?.message ?? 'Reply draft not found' };
  }
  if (row.status !== 'approved') {
    return { success: false, draft_id: replyDraftId, error: 'Approve this reply before publishing' };
  }
  return publishReplyDraft(row as ReplyDraftRow);
}
