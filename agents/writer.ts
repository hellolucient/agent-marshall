/**
 * Writer Agent — Generate drafts: 2 daily tweets, 1 weekly thread, 1 weekly Substack outline.
 * Uses top-scoring ideas from swarm; writes in Marshall's voice.
 */

import { complete } from '@/lib/llm';
import { loadIdentity } from '@/lib/templates';
import { supabase } from '@/lib/supabase';
import type { PostIdea } from '@/lib/supabase';

export type DraftTweet = { content: string; idea_id: string };
export type DraftThread = { tweets: string[]; idea_id: string };
export type DraftSubstack = { title: string; outline: string; body_notes: string; idea_id: string };

async function getTopIdeasByType(type: string, limit: number): Promise<PostIdea[]> {
  const { data, error } = await supabase
    .from('post_ideas')
    .select('*')
    .eq('idea_type', type)
    .not('aggregate_score', 'is', null)
    .order('aggregate_score', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PostIdea[];
}

async function writeTweetFromIdea(idea: PostIdea): Promise<string> {
  const identity = loadIdentity();
  const system = `${identity}\n\nWrite a single tweet from this idea. Marshall's voice: calm, intellectual, concise. Max 280 characters. No hashtags, no engagement bait. Output only the tweet text.`;
  const user = `Idea: ${idea.idea_text}`;
  return complete(
    [{ role: 'system', content: system }, { role: 'user', content: user }],
    { temperature: 0.6 }
  );
}

async function writeThreadFromIdea(idea: PostIdea): Promise<string[]> {
  const identity = loadIdentity();
  const system = `${identity}\n\nWrite a thread of 5-8 tweets from this idea. Each tweet on its own line. Number them 1., 2., etc. Marshall's voice: calm, intellectual, concise. No hashtags. Each line must be under 280 characters.`;
  const user = `Idea: ${idea.idea_text}`;
  const raw = await complete(
    [{ role: 'system', content: system }, { role: 'user', content: user }],
    { temperature: 0.6 }
  );
  const lines = raw.split('\n').map((l) => l.replace(/^\d+\.\s*/, '').trim()).filter((l) => l.length > 0 && l.length <= 280);
  return lines.slice(0, 10);
}

async function writeSubstackOutlineFromIdea(idea: PostIdea): Promise<{ title: string; outline: string; body_notes: string }> {
  const identity = loadIdentity();
  const system = `${identity}\n\nCreate a Substack post outline from this idea. Respond with exactly three sections, each on a new line:\nTITLE: [working title]\nOUTLINE: [3-5 bullet points]\nBODY_NOTES: [2-4 sentences of key arguments to expand]`;
  const user = `Idea: ${idea.idea_text}`;
  const raw = await complete(
    [{ role: 'system', content: system }, { role: 'user', content: user }],
    { temperature: 0.6 }
  );
  const title = raw.match(/TITLE:\s*(.+?)(?:\n|$)/i)?.[1]?.trim() ?? idea.idea_text.slice(0, 80);
  const outline = raw.match(/OUTLINE:\s*([\s\S]+?)(?=BODY_NOTES|$)/i)?.[1]?.trim() ?? '';
  const body_notes = raw.match(/BODY_NOTES:\s*([\s\S]+?)$/i)?.[1]?.trim() ?? '';
  return { title, outline, body_notes };
}

export async function generateDailyTweets(): Promise<DraftTweet[]> {
  const ideas = await getTopIdeasByType('tweet', 3);
  const drafts: DraftTweet[] = [];
  for (const idea of ideas.slice(0, 2)) {
    const content = await writeTweetFromIdea(idea);
    if (content.length <= 280) drafts.push({ content, idea_id: idea.id });
  }
  return drafts;
}

export async function generateWeeklyThread(): Promise<DraftThread | null> {
  const ideas = await getTopIdeasByType('thread', 1);
  if (ideas.length === 0) return null;
  const tweets = await writeThreadFromIdea(ideas[0]);
  if (tweets.length < 2) return null;
  return { tweets, idea_id: ideas[0].id };
}

export async function generateWeeklySubstackOutline(): Promise<DraftSubstack | null> {
  const ideas = await getTopIdeasByType('substack', 1);
  if (ideas.length === 0) return null;
  const outline = await writeSubstackOutlineFromIdea(ideas[0]);
  return { ...outline, idea_id: ideas[0].id };
}

export async function saveDraftTweet(draft: DraftTweet): Promise<string> {
  const { data, error } = await supabase
    .from('draft_posts')
    .insert({
      post_idea_id: draft.idea_id,
      draft_type: 'tweet',
      content: draft.content,
      status: 'draft',
      metadata: {},
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function saveDraftThread(draft: DraftThread): Promise<string> {
  const [first, ...rest] = draft.tweets;
  const { data, error } = await supabase
    .from('draft_posts')
    .insert({
      post_idea_id: draft.idea_id,
      draft_type: 'thread',
      content: first ?? '',
      thread_tweets: rest,
      status: 'draft',
      metadata: {},
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function saveDraftSubstack(draft: DraftSubstack): Promise<string> {
  const { data, error } = await supabase
    .from('draft_posts')
    .insert({
      post_idea_id: draft.idea_id,
      draft_type: 'substack_outline',
      content: draft.title,
      metadata: { outline: draft.outline, body_notes: draft.body_notes },
      status: 'draft',
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

/** Run daily writing: 2 tweets. */
export async function runDailyWriting(): Promise<{ tweets: number }> {
  const tweets = await generateDailyTweets();
  for (const t of tweets) await saveDraftTweet(t);
  return { tweets: tweets.length };
}

/** Run weekly writing: 1 thread, 1 Substack outline. */
export async function runWeeklyWriting(): Promise<{ thread: boolean; substack: boolean }> {
  let thread = false;
  let substack = false;
  const threadDraft = await generateWeeklyThread();
  if (threadDraft) {
    await saveDraftThread(threadDraft);
    thread = true;
  }
  const subDraft = await generateWeeklySubstackOutline();
  if (subDraft) {
    await saveDraftSubstack(subDraft);
    substack = true;
  }
  return { thread, substack };
}
