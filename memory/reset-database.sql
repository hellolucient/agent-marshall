-- Agent Marshall — wipe all pipeline data (fresh start).
-- Run in Supabase SQL Editor. Reply engager code is unchanged; only stored rows are removed.

TRUNCATE TABLE
  public.performance_metrics,
  public.published_posts,
  public.reply_drafts,
  public.draft_posts,
  public.post_ideas,
  public.research_items,
  public.interactions,
  public.followed_accounts,
  public.reflection_notes
RESTART IDENTITY CASCADE;

-- Sanity: SELECT count(*) FROM public.draft_posts;  → should be 0
-- UI still old? App .env NEXT_PUBLIC_SUPABASE_URL must match THIS Supabase project.
