-- Run once in Supabase SQL Editor (existing projects). New installs: see schemas.sql
CREATE TABLE IF NOT EXISTS public.reply_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  reply_to_post_id TEXT NOT NULL,
  reply_to_author TEXT,
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  published_post_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reply_drafts_status ON public.reply_drafts(status);
CREATE INDEX IF NOT EXISTS idx_reply_drafts_created ON public.reply_drafts(created_at DESC);

-- Allow published log for replies without draft_posts row
ALTER TABLE public.published_posts ALTER COLUMN draft_post_id DROP NOT NULL;
ALTER TABLE public.published_posts
  ADD COLUMN IF NOT EXISTS reply_draft_id UUID REFERENCES public.reply_drafts(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.published_posts.reply_draft_id IS 'Set when publish was a reply draft; draft_post_id null.';
