-- Agent Marshall — Supabase schema (public)
-- Run the ENTIRE file in Supabase SQL Editor → Run (one shot).
-- Tables appear under Table Editor → schema "public".

-- Research items (RSS, articles, papers, notes)
CREATE TABLE IF NOT EXISTS public.research_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL, -- 'rss' | 'article' | 'paper' | 'manual_note' | 'ai_news' | 'twitter'
  source_url TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  raw_content TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_research_items_created ON public.research_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_items_source ON public.research_items(source_type);

-- Post ideas (candidates before swarm)
CREATE TABLE IF NOT EXISTS public.post_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_item_ids UUID[],
  idea_text TEXT NOT NULL,
  idea_type TEXT NOT NULL, -- 'tweet' | 'thread' | 'substack' | 'reply'
  swarm_scores JSONB DEFAULT '{}', -- { philosopher, skeptic, futurist, editor, signal_analyst }
  aggregate_score NUMERIC(5,2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'candidate' -- 'candidate' | 'selected' | 'rejected'
);

CREATE INDEX IF NOT EXISTS idx_post_ideas_created ON public.post_ideas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_ideas_status ON public.post_ideas(status);

-- Draft posts (tweets, threads, replies, substack)
CREATE TABLE IF NOT EXISTS public.draft_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_idea_id UUID REFERENCES public.post_ideas(id),
  draft_type TEXT NOT NULL, -- 'tweet' | 'thread' | 'reply' | 'substack_outline'
  content TEXT, -- single tweet or first tweet of thread
  thread_tweets TEXT[], -- for threads: [tweet2, tweet3, ...]
  reply_to_post_id TEXT, -- X post id when draft_type = 'reply'
  reply_to_author TEXT,
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft', -- 'draft' | 'approved' | 'published' | 'rejected'
  published_at TIMESTAMPTZ,
  published_post_id TEXT, -- X id after publish
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_draft_posts_status ON public.draft_posts(status);
CREATE INDEX IF NOT EXISTS idx_draft_posts_type ON public.draft_posts(draft_type);
CREATE INDEX IF NOT EXISTS idx_draft_posts_created ON public.draft_posts(created_at DESC);

-- Published posts (record of what went out)
CREATE TABLE IF NOT EXISTS public.published_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_post_id UUID REFERENCES public.draft_posts(id),
  platform TEXT NOT NULL, -- 'x' | 'substack'
  platform_post_id TEXT,
  content_preview TEXT,
  metadata JSONB DEFAULT '{}',
  published_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_published_posts_published ON public.published_posts(published_at DESC);

-- Interactions (replies we've made, mentions, DMs if ever)
CREATE TABLE IF NOT EXISTS public.interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL DEFAULT 'x',
  interaction_type TEXT NOT NULL, -- 'reply' | 'mention' | 'like'
  target_post_id TEXT,
  target_author_id TEXT,
  target_author_handle TEXT,
  our_post_id TEXT,
  our_content TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interactions_created ON public.interactions(created_at DESC);

-- Accounts Marshall follows or is recommended to follow
CREATE TABLE IF NOT EXISTS public.followed_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL DEFAULT 'x',
  account_id TEXT,
  handle TEXT NOT NULL,
  display_name TEXT,
  bio TEXT,
  recommendation_reason TEXT,
  status TEXT DEFAULT 'recommended', -- 'recommended' | 'followed' | 'dismissed'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  followed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_followed_accounts_status ON public.followed_accounts(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_followed_accounts_handle ON public.followed_accounts(platform, handle);

-- Performance metrics (engagement, growth)
CREATE TABLE IF NOT EXISTS public.performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL, -- 'engagement' | 'follower_change' | 'topic_performance'
  platform TEXT NOT NULL DEFAULT 'x',
  post_id UUID REFERENCES public.draft_posts(id),
  value NUMERIC,
  dimensions JSONB DEFAULT '{}', -- e.g. { topic, timeframe }
  recorded_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_recorded ON public.performance_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_type ON public.performance_metrics(metric_type);

-- Reflection notes (weekly analysis)
CREATE TABLE IF NOT EXISTS public.reflection_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  summary TEXT NOT NULL,
  tweet_engagement_notes TEXT,
  topic_performance_notes TEXT,
  reply_effectiveness_notes TEXT,
  audience_growth_notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reflection_notes_period ON public.reflection_notes(period_end DESC);
