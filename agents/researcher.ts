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

export async function saveResearchItem(input: ResearchInput): Promise<string> {
  const { data, error } = await supabase
    .from('research_items')
    .insert({
      source_type: input.source_type,
      source_url: input.source_url ?? null,
      title: input.title,
      summary: input.summary ?? null,
      raw_content: input.raw_content ?? null,
      metadata: input.metadata ?? {},
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

  const { fetchTwitterResearchInputs } = await import('@/agents/twitterResearch');
  const twitterItems = await fetchTwitterResearchInputs();

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
