/**
 * Optional Twitter/X research — recent search → research_items.
 * Complements RSS with on-platform discourse for tweet-native ideas.
 *
 * Requires X OAuth 1.0a (same env as publishing). Recent search often needs
 * a paid X API tier; Free may return 403 — errors are logged, cycle continues.
 */

import { TwitterApi } from 'twitter-api-v2';

/** Same shape as researcher ResearchInput (avoid circular import). */
type TwitterResearchInput = {
  source_type: 'twitter';
  source_url?: string;
  title: string;
  summary?: string;
  raw_content?: string;
  metadata?: Record<string, unknown>;
};

function hasTwitterCredentials(): boolean {
  return Boolean(
    process.env.X_API_KEY &&
      process.env.X_API_SECRET &&
      process.env.X_ACCESS_TOKEN &&
      process.env.X_ACCESS_TOKEN_SECRET
  );
}

function tweetPermalink(id: string, username?: string): string {
  if (username) return `https://x.com/${username}/status/${id}`;
  return `https://x.com/i/web/status/${id}`;
}

const MAX_RESULTS_ALLOWED = [10, 25, 50, 100] as const;

function clampMaxResults(n: number): 10 | 25 | 50 | 100 {
  for (const v of MAX_RESULTS_ALLOWED) {
    if (n <= v) return v;
  }
  return 100;
}

/**
 * RESEARCH_TWITTER_QUERIES=comma-separated recent-search queries.
 * Each tweet → one research item (idea generator sees it like RSS lines).
 */
export async function fetchTwitterResearchInputs(): Promise<TwitterResearchInput[]> {
  const queriesEnv = process.env.RESEARCH_TWITTER_QUERIES?.trim();
  if (!queriesEnv || !hasTwitterCredentials()) {
    return [];
  }
  const queries = queriesEnv.split(',').map((q) => q.trim()).filter(Boolean);
  if (queries.length === 0) return [];

  const maxPerQuery = clampMaxResults(
    parseInt(process.env.RESEARCH_TWITTER_MAX_PER_QUERY ?? '15', 10) || 15
  );

  const client = new TwitterApi({
    appKey: process.env.X_API_KEY!,
    appSecret: process.env.X_API_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN!,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET!,
  });
  const ro = client.readOnly.v2;

  const out: TwitterResearchInput[] = [];
  const seenIds = new Set<string>();

  for (const query of queries) {
    try {
      const page = await ro.search(query, {
        max_results: maxPerQuery,
        expansions: ['author_id'],
        'tweet.fields': ['created_at', 'author_id'],
        'user.fields': ['username'],
      });
      const userMap = new Map<string, string>();
      for (const u of page.includes.users) {
        userMap.set(u.id, u.username);
      }
      for (const t of page.tweets) {
        if (seenIds.has(t.id)) continue;
        seenIds.add(t.id);
        const text = t.text ?? '';
        const username = t.author_id ? userMap.get(t.author_id) : undefined;
        const url = tweetPermalink(t.id, username);
        const title = (text.slice(0, 200) || 'Tweet') + (text.length > 200 ? '…' : '');
        out.push({
          source_type: 'twitter',
          source_url: url,
          title,
          summary: text.slice(0, 1000),
          raw_content: text,
          metadata: {
            twitterQuery: query,
            tweetId: t.id,
            authorId: t.author_id,
            username,
            createdAt: t.created_at,
          },
        });
      }
    } catch (e) {
      console.error(`Twitter search failed for "${query}":`, e);
    }
  }

  return out;
}
