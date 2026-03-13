/**
 * Twitter/X research — recent search → research_items.
 * Cost control: default 1 query × 10 tweets per run; heartbeat skips Twitter unless enabled.
 */

import { TwitterApi } from 'twitter-api-v2';

type TwitterResearchInput = {
  source_type: 'twitter';
  source_url?: string;
  title: string;
  summary?: string;
  raw_content?: string;
  metadata?: Record<string, unknown>;
};

export function hasTwitterCredentials(): boolean {
  return Boolean(
    process.env.X_API_KEY &&
      process.env.X_API_SECRET &&
      process.env.X_ACCESS_TOKEN &&
      process.env.X_ACCESS_TOKEN_SECRET
  );
}

export function twitterResearchConfigured(): {
  xKeysOk: boolean;
  queriesOk: boolean;
  queryCount: number;
  queriesThisRun: number;
} {
  const q = process.env.RESEARCH_TWITTER_QUERIES?.trim();
  const queries = q ? q.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const maxQ = Math.max(
    1,
    parseInt(process.env.RESEARCH_TWITTER_MAX_QUERIES_PER_RUN ?? '1', 10) || 1
  );
  return {
    xKeysOk: hasTwitterCredentials(),
    queriesOk: queries.length > 0,
    queryCount: queries.length,
    queriesThisRun: Math.min(maxQ, queries.length || 0),
  };
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

function errMsg(e: unknown): string {
  if (e && typeof e === 'object' && 'data' in e) {
    const d = (e as { data?: { detail?: string; title?: string } }).data;
    if (d?.detail) return String(d.detail);
    if (d?.title) return String(d.title);
  }
  return e instanceof Error ? e.message : String(e);
}

/**
 * Only runs first N queries (default 1) and max 10 results/query (default) to limit $/refresh.
 * Heartbeat should not call this unless RESEARCH_TWITTER_ON_HEARTBEAT=true.
 */
export async function fetchTwitterResearchWithDiagnostics(): Promise<{
  items: TwitterResearchInput[];
  errors: string[];
  blocked?: 'no_queries' | 'no_x_keys';
  queriesUsed: number;
}> {
  const errors: string[] = [];
  if (!hasTwitterCredentials()) {
    return { items: [], errors, blocked: 'no_x_keys', queriesUsed: 0 };
  }
  const queriesEnv = process.env.RESEARCH_TWITTER_QUERIES?.trim();
  const allQueries = queriesEnv ? queriesEnv.split(',').map((q) => q.trim()).filter(Boolean) : [];
  if (allQueries.length === 0) {
    return { items: [], errors, blocked: 'no_queries', queriesUsed: 0 };
  }

  const maxQueries = Math.max(
    1,
    parseInt(process.env.RESEARCH_TWITTER_MAX_QUERIES_PER_RUN ?? '1', 10) || 1
  );
  const queries = allQueries.slice(0, maxQueries);

  const maxPerQuery = clampMaxResults(
    parseInt(process.env.RESEARCH_TWITTER_MAX_PER_QUERY ?? '10', 10) || 10
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
        'tweet.fields': ['created_at', 'author_id', 'referenced_tweets'],
        'user.fields': ['username'],
      });
      const userMap = new Map<string, string>();
      for (const u of page.includes.users) {
        userMap.set(u.id, u.username);
      }
      for (const t of page.tweets) {
        if (seenIds.has(t.id)) continue;
        seenIds.add(t.id);
        const refs = (t as { referenced_tweets?: { type: string; id: string }[] }).referenced_tweets;
        const retweeted = refs?.find((r) => r.type === 'retweeted');
        /** Reply + full text should target the *original* post, not the reposter. */
        const replyTargetId = retweeted?.id ?? t.id;
        const surfaceUsername = t.author_id ? userMap.get(t.author_id) : undefined;
        const text = (t.text ?? '').trim();
        const url = retweeted
          ? `https://x.com/i/status/${replyTargetId}`
          : tweetPermalink(t.id, surfaceUsername);
        const title =
          (retweeted ? '(RT) ' : '') +
          (text.slice(0, 200) || 'Tweet') +
          (text.length > 200 ? '…' : '');
        const replyTargetStr = String(replyTargetId);
        const meta: Record<string, unknown> = {
          twitterQuery: query,
          tweetId: String(t.id),
          replyTargetTweetId: retweeted ? replyTargetStr : String(t.id),
          isRetweet: !!retweeted,
        };
        if (surfaceUsername) meta.surfaceAuthor = surfaceUsername;
        if (t.author_id != null) meta.authorId = String(t.author_id);
        if (t.created_at) meta.createdAt = String(t.created_at);
        out.push({
          source_type: 'twitter',
          source_url: url,
          title,
          summary: text.slice(0, 1000) || 'Open full post — retweet shell may have no text here.',
          raw_content: text || '',
          metadata: meta,
        });
      }
    } catch (e) {
      const msg = errMsg(e);
      errors.push(`Query "${query.slice(0, 40)}${query.length > 40 ? '…' : ''}": ${msg}`);
      console.error(`Twitter search failed for "${query}":`, e);
    }
  }

  return { items: out, errors, queriesUsed: queries.length };
}

export async function fetchTwitterResearchInputs(): Promise<TwitterResearchInput[]> {
  const { items } = await fetchTwitterResearchWithDiagnostics();
  return items;
}
