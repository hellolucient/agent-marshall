/**
 * Researcher Agent — Collect and normalize inputs into research_items.
 * Sources: RSS, saved articles, research papers, AI news, manual notes.
 */

import Parser from 'rss-parser';
import { supabase } from '@/lib/supabase';

const parser = new Parser();

export type ResearchInput = {
  source_type: 'rss' | 'article' | 'paper' | 'manual_note' | 'ai_news' | 'twitter';
  source_url?: string;
  title: string;
  summary?: string;
  raw_content?: string;
  metadata?: Record<string, unknown>;
};

export async function fetchRssFeed(feedUrl: string): Promise<ResearchInput[]> {
  const feed = await parser.parseURL(feedUrl);
  return feed.items.map((item) => ({
    source_type: 'rss' as const,
    source_url: item.link ?? undefined,
    title: item.title ?? 'Untitled',
    summary: item.contentSnippet?.slice(0, 1000) ?? item.content?.slice(0, 1000),
    raw_content: item.content ?? undefined,
    metadata: { feedTitle: feed.title, published: item.pubDate },
  }));
}

export async function fetchAllRssFeeds(feedUrls: string[]): Promise<ResearchInput[]> {
  const results: ResearchInput[] = [];
  for (const url of feedUrls) {
    try {
      const items = await fetchRssFeed(url);
      results.push(...items);
    } catch (e) {
      console.error(`RSS fetch failed for ${url}:`, e);
    }
  }
  return results;
}

/** PostgREST PGRST102 "Empty or invalid json" — usually bad JSONB. Force plain JSON. */
function safeJsonb(meta: Record<string, unknown>): Record<string, unknown> {
  const plain: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined) continue;
    if (v === null) {
      plain[k] = null;
      continue;
    }
    if (typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number') {
      if (typeof v === 'number' && (!Number.isFinite(v) || Number.isNaN(v))) continue;
      plain[k] = v;
    } else {
      plain[k] = String(v);
    }
  }
  try {
    return JSON.parse(JSON.stringify(plain)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function safeText(s: string | null | undefined, max: number): string | null {
  if (s == null) return null;
  const t = String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .slice(0, max);
  return t.length ? t : null;
}

export async function saveResearchItem(input: ResearchInput): Promise<string> {
  const { data, error } = await supabase
    .from('research_items')
    .insert({
      source_type: input.source_type,
      source_url: input.source_url ?? null,
      title: safeText(input.title, 5000) ?? 'Untitled',
      summary: safeText(input.summary ?? null, 2000),
      raw_content: safeText(input.raw_content ?? null, 50000),
      metadata: safeJsonb(input.metadata ?? {}),
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function saveResearchItems(inputs: ResearchInput[]): Promise<string[]> {
  const ids: string[] = [];
  for (const input of inputs) {
    const id = await saveResearchItem(input);
    ids.push(id);
  }
  return ids;
}

/** Run research cycle: RSS + optional Twitter recent search → dedupe → save. */
export async function runResearchCycle(): Promise<{ saved: number; rss: number; twitter: number }> {
  const feedsEnv = process.env.RESEARCH_RSS_FEEDS;
  const feedUrls = feedsEnv ? feedsEnv.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const rssItems =
    feedUrls.length > 0 ? await fetchAllRssFeeds(feedUrls) : [];

  let twitterItems: Awaited<
    ReturnType<typeof import('@/agents/twitterResearch').fetchTwitterResearchInputs>
  > = [];
  if (process.env.RESEARCH_TWITTER_ON_HEARTBEAT === 'true') {
    const { fetchTwitterResearchInputs } = await import('@/agents/twitterResearch');
    twitterItems = await fetchTwitterResearchInputs();
  }

  const items = [...rssItems, ...twitterItems];
  if (items.length === 0) {
    return { saved: 0, rss: 0, twitter: 0 };
  }

  const existing = await supabase.from('research_items').select('title, source_url').limit(5000);
  const existingSet = new Set(
    (existing.data ?? []).map((r) => `${r.title}|${r.source_url ?? ''}`)
  );
  const newItems = items.filter((i) => !existingSet.has(`${i.title}|${i.source_url ?? ''}`));
  const saved = await saveResearchItems(newItems);
  const rssNew = newItems.filter((i) => i.source_type === 'rss').length;
  const twitterNew = newItems.filter((i) => i.source_type === 'twitter').length;
  return { saved: saved.length, rss: rssNew, twitter: twitterNew };
}

/** Twitter search only (for Reply targets UI). Dedupes like full cycle. */
export async function runTwitterResearchOnly(): Promise<{
  saved: number;
  fetched: number;
  queriesUsed?: number;
  blocked?: 'no_queries' | 'no_x_keys';
  xErrors?: string[];
  note?: string;
}> {
  const { fetchTwitterResearchWithDiagnostics } = await import('@/agents/twitterResearch');
  const { items: twitterItems, errors: xErrors, blocked, queriesUsed } =
    await fetchTwitterResearchWithDiagnostics();
  if (blocked) {
    return {
      saved: 0,
      fetched: 0,
      blocked,
      queriesUsed: 0,
      xErrors: xErrors.length ? xErrors : undefined,
    };
  }
  if (twitterItems.length === 0) {
    return {
      saved: 0,
      fetched: 0,
      queriesUsed,
      xErrors: xErrors.length ? xErrors : undefined,
      note:
        xErrors.length > 0
          ? 'Every search query failed (see errors). Often 403 = need paid X API tier for recent search.'
          : undefined,
    };
  }
  const existing = await supabase.from('research_items').select('title, source_url').limit(5000);
  const existingSet = new Set(
    (existing.data ?? []).map((r) => `${r.title}|${r.source_url ?? ''}`)
  );
  const newItems = twitterItems.filter((i) => !existingSet.has(`${i.title}|${i.source_url ?? ''}`));
  const saved = newItems.length ? await saveResearchItems(newItems) : [];
  const note =
    saved.length === 0 && twitterItems.length > 0
      ? `${twitterItems.length} tweet(s) from X were already in the DB (dedupe). List below may still be empty if you never had twitter rows — try a new query.`
      : undefined;
  return {
    saved: saved.length,
    fetched: twitterItems.length,
    queriesUsed,
    xErrors: xErrors.length ? xErrors : undefined,
    note,
  };
}
