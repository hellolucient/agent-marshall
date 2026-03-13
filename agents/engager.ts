/**
 * Engager Agent — Generate thoughtful reply drafts to relevant X discussions.
 * Adds insight; avoids praise-only or automated-sounding replies. Limited volume.
 */

import { complete } from '@/lib/llm';
import { loadIdentity } from '@/lib/templates';
import { supabase } from '@/lib/supabase';

export type DiscussionContext = {
  post_id: string;
  author_handle: string;
  author_display_name?: string;
  content: string;
  thread_context?: string;
};

export type ReplyDraft = {
  content: string;
  reply_to_post_id: string;
  reply_to_author: string;
};

const MAX_REPLY_DRAFTS_PER_DAY = 12;
const MIN_REPLY_LENGTH = 20;
const MAX_REPLY_LENGTH = 280;

export async function generateReplyDraft(context: DiscussionContext): Promise<ReplyDraft | null> {
  const identity = loadIdentity();
  const system = `${identity}\n\nYou are drafting a reply as Marshall. Rules:
- Add real insight or a new angle. Do not just praise or say "great point."
- Do not sound automated. No "Thanks for sharing!" or "Interesting perspective!"
- Be concise. One or two sentences. Under 280 characters.
- If you disagree, be precise and civil.
- Output only the reply text, nothing else.`;

  const user = `Post by @${context.author_handle}:\n"${context.content}"\n${context.thread_context ? `Context: ${context.thread_context}\n` : ''}\nWrite a single reply tweet:`;

  const raw = await complete(
    [{ role: 'system', content: system }, { role: 'user', content: user }],
    { temperature: 0.6 }
  );
  const content = raw.trim().slice(0, MAX_REPLY_LENGTH);
  if (content.length < MIN_REPLY_LENGTH) return null;
  return {
    content,
    reply_to_post_id: context.post_id,
    reply_to_author: context.author_handle,
  };
}

export async function saveReplyDraft(draft: ReplyDraft): Promise<string> {
  const { data, error } = await supabase
    .from('draft_posts')
    .insert({
      draft_type: 'reply',
      content: draft.content,
      reply_to_post_id: draft.reply_to_post_id,
      reply_to_author: draft.reply_to_author,
      status: 'draft',
      metadata: {},
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function countReplyDraftsToday(): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from('draft_posts')
    .select('*', { count: 'exact', head: true })
    .eq('draft_type', 'reply')
    .gte('created_at', start.toISOString());
  if (error) throw error;
  return count ?? 0;
}

/** Generate reply drafts for a list of discussions. Stops when daily cap is reached. */
export async function runEngagerCycle(discussions: DiscussionContext[]): Promise<{ drafted: number }> {
  const existing = await countReplyDraftsToday();
  const remaining = Math.max(0, MAX_REPLY_DRAFTS_PER_DAY - existing);
  if (remaining === 0) return { drafted: 0 };
  let drafted = 0;
  for (const ctx of discussions.slice(0, remaining)) {
    try {
      const draft = await generateReplyDraft(ctx);
      if (draft) {
        await saveReplyDraft(draft);
        drafted++;
      }
    } catch (e) {
      console.error('Engager draft failed', e);
    }
  }
  return { drafted };
}
