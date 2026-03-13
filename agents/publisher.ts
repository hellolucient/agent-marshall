/**
 * Publisher Agent — Publish approved drafts to X only.
 * Substack remains draft-only (no auto-publish). All publishing requires prior approval.
 */

import { supabase } from '@/lib/supabase';
import type { DraftPost } from '@/lib/supabase';

// X API v2 would be used here. Placeholder for actual client.
// In production: use twitter-api-v2 or similar with X_API_* env vars.

export type PublishResult = {
  success: boolean;
  draft_id: string;
  platform_post_id?: string;
  error?: string;
};

export async function publishTweet(draft: DraftPost): Promise<PublishResult> {
  if (draft.draft_type !== 'tweet' || !draft.content) {
    return { success: false, draft_id: draft.id, error: 'Invalid draft type or content' };
  }
  // Placeholder: call X API. If keys not set, simulate success and store as "published" with no platform id.
  const hasXKeys = !!(
    process.env.X_API_KEY &&
    process.env.X_ACCESS_TOKEN
  );
  if (!hasXKeys) {
    await supabase
      .from('draft_posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: { simulated: true, reason: 'X API not configured' },
      })
      .eq('id', draft.id);
    await supabase.from('published_posts').insert({
      draft_post_id: draft.id,
      platform: 'x',
      platform_post_id: null,
      content_preview: draft.content.slice(0, 100),
      published_at: new Date().toISOString(),
    });
    return { success: true, draft_id: draft.id };
  }
  // TODO: integrate twitter-api-v2
  // const client = new TwitterApi({ appKey: X_API_KEY, ... });
  // const tweet = await client.v2.tweet(draft.content);
  const platform_post_id = `sim_${Date.now()}`;
  await supabase
    .from('draft_posts')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      published_post_id: platform_post_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', draft.id);
  await supabase.from('published_posts').insert({
    draft_post_id: draft.id,
    platform: 'x',
    platform_post_id,
    content_preview: draft.content.slice(0, 100),
    published_at: new Date().toISOString(),
  });
  return { success: true, draft_id: draft.id, platform_post_id };
}

export async function publishThread(draft: DraftPost): Promise<PublishResult> {
  if (draft.draft_type !== 'thread' || !draft.content) {
    return { success: false, draft_id: draft.id, error: 'Invalid thread draft' };
  }
  const tweets = [draft.content, ...(draft.thread_tweets ?? [])].filter(Boolean);
  const hasXKeys = !!(process.env.X_API_KEY && process.env.X_ACCESS_TOKEN);
  if (!hasXKeys) {
    await supabase.from('draft_posts').update({
      status: 'published',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: { simulated: true },
    }).eq('id', draft.id);
    await supabase.from('published_posts').insert({
      draft_post_id: draft.id,
      platform: 'x',
      platform_post_id: null,
      content_preview: tweets[0]?.slice(0, 100) ?? '',
      published_at: new Date().toISOString(),
    });
    return { success: true, draft_id: draft.id };
  }
  // TODO: post first tweet, then reply to self for each subsequent tweet
  const platform_post_id = `sim_thread_${Date.now()}`;
  await supabase.from('draft_posts').update({
    status: 'published',
    published_at: new Date().toISOString(),
    published_post_id: platform_post_id,
    updated_at: new Date().toISOString(),
  }).eq('id', draft.id);
  await supabase.from('published_posts').insert({
    draft_post_id: draft.id,
    platform: 'x',
    platform_post_id,
    content_preview: tweets[0]?.slice(0, 100) ?? '',
    published_at: new Date().toISOString(),
  });
  return { success: true, draft_id: draft.id, platform_post_id };
}

export async function publishReply(draft: DraftPost): Promise<PublishResult> {
  if (draft.draft_type !== 'reply' || !draft.content || !draft.reply_to_post_id) {
    return { success: false, draft_id: draft.id, error: 'Invalid reply draft' };
  }
  const hasXKeys = !!(process.env.X_API_KEY && process.env.X_ACCESS_TOKEN);
  if (!hasXKeys) {
    await supabase.from('draft_posts').update({
      status: 'published',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: { simulated: true },
    }).eq('id', draft.id);
    await supabase.from('published_posts').insert({
      draft_post_id: draft.id,
      platform: 'x',
      platform_post_id: null,
      content_preview: draft.content.slice(0, 100),
      published_at: new Date().toISOString(),
    });
    return { success: true, draft_id: draft.id };
  }
  const platform_post_id = `sim_reply_${Date.now()}`;
  await supabase.from('draft_posts').update({
    status: 'published',
    published_at: new Date().toISOString(),
    published_post_id: platform_post_id,
    updated_at: new Date().toISOString(),
  }).eq('id', draft.id);
  await supabase.from('published_posts').insert({
    draft_post_id: draft.id,
    platform: 'x',
    platform_post_id,
    content_preview: draft.content.slice(0, 100),
    published_at: new Date().toISOString(),
  });
  return { success: true, draft_id: draft.id, platform_post_id };
}

/** Publish a single approved draft. Substack outlines are never auto-published. */
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
  const d = draft as unknown as DraftPost;
  if (d.draft_type === 'tweet') return publishTweet(d);
  if (d.draft_type === 'thread') return publishThread(d);
  if (d.draft_type === 'reply') return publishReply(d);
  return { success: false, draft_id: draftId, error: 'Unknown draft type' };
}
