import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

/** Server-side Supabase client with service role. Lazy-initialized so build works without env. */
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    _supabase = createClient(url, key, { auth: { persistSession: false } });
  }
  return _supabase;
}

/** Alias for getSupabase() for backward compatibility. Use getSupabase() in new code. */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return getSupabase()[prop as keyof SupabaseClient];
  },
});

/** Types for our tables (minimal for agent use). */
export type ResearchItem = {
  id: string;
  source_type: string;
  source_url: string | null;
  title: string;
  summary: string | null;
  raw_content: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  processed_at: string | null;
};

export type PostIdea = {
  id: string;
  research_item_ids: string[] | null;
  idea_text: string;
  idea_type: string;
  swarm_scores: Record<string, number>;
  aggregate_score: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  status: string;
};

export type DraftPost = {
  id: string;
  post_idea_id: string | null;
  draft_type: 'tweet' | 'thread' | 'reply' | 'substack_outline';
  content: string | null;
  thread_tweets: string[] | null;
  reply_to_post_id: string | null;
  reply_to_author: string | null;
  metadata: Record<string, unknown>;
  status: 'draft' | 'approved' | 'published' | 'rejected';
  published_at: string | null;
  published_post_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PublishedPost = {
  id: string;
  draft_post_id: string | null;
  platform: string;
  platform_post_id: string | null;
  content_preview: string | null;
  metadata: Record<string, unknown>;
  published_at: string;
  created_at: string;
};

export type Interaction = {
  id: string;
  platform: string;
  interaction_type: string;
  target_post_id: string | null;
  target_author_id: string | null;
  target_author_handle: string | null;
  our_post_id: string | null;
  our_content: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type FollowedAccount = {
  id: string;
  platform: string;
  account_id: string | null;
  handle: string;
  display_name: string | null;
  bio: string | null;
  recommendation_reason: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  followed_at: string | null;
};

export type PerformanceMetric = {
  id: string;
  metric_type: string;
  platform: string;
  post_id: string | null;
  value: number | null;
  dimensions: Record<string, unknown>;
  recorded_at: string;
  metadata: Record<string, unknown>;
};

export type ReflectionNote = {
  id: string;
  period_start: string;
  period_end: string;
  summary: string;
  tweet_engagement_notes: string | null;
  topic_performance_notes: string | null;
  reply_effectiveness_notes: string | null;
  audience_growth_notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};
