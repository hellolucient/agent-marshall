/**
 * Single-tweet lookup (GET /2/tweets/:id). Minimal fields — some tiers 400 on note_tweet.
 */
import { getXReadWrite } from '@/lib/xClient';
import type { TwitterApi } from 'twitter-api-v2';

export function tweetIdFromStatusUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = String(url).match(/status\/(\d{5,30})/);
  return m ? m[1] : null;
}

/**
 * Id for lookup + reply: original post if retweet (replyTargetTweetId), else permalink id.
 * URL is already canonical to original when we ingest retweets.
 */
export function resolveTweetIdForLookup(
  sourceUrl: string | null,
  meta: Record<string, unknown>
): string | null {
  const target = meta.replyTargetTweetId;
  if (target != null) {
    const s = String(target).trim();
    if (/^\d{5,30}$/.test(s)) return s;
  }
  const fromUrl = tweetIdFromStatusUrl(sourceUrl);
  if (fromUrl) return fromUrl;
  const v = meta.tweetId;
  if (v == null) return null;
  const s = String(v).trim();
  return /^\d{5,30}$/.test(s) ? s : null;
}

export type FetchTweetResult =
  | { ok: true; text: string; username: string | null }
  | { ok: false; error: string; code?: number };

export async function fetchTweetById(tweetId: string): Promise<FetchTweetResult> {
  const client = getXReadWrite();
  if (!client) {
    return { ok: false, error: 'X API keys missing on server' };
  }
  const ro = client.readOnly.v2 as TwitterApi['readOnly']['v2'];
  try {
    const res = await ro.singleTweet(tweetId, {
      'tweet.fields': ['author_id'],
      expansions: ['author_id'],
      'user.fields': ['username'],
    });
    const t = res.data;
    if (!t) return { ok: false, error: 'X returned no tweet (deleted/private?)' };
    const text = (t.text ?? '').trim();
    if (!text) return { ok: false, error: 'X returned empty text' };
    const authorId = t.author_id;
    const users = res.includes?.users ?? [];
    const author = users.find((u) => u.id === authorId) ?? users[0];
    return { ok: true, text, username: author?.username ?? null };
  } catch (e: unknown) {
    const err = e as { code?: number; data?: { detail?: string }; message?: string };
    const detail =
      err?.data?.detail ??
      (typeof err?.message === 'string' ? err.message : null) ??
      String(e);
    return { ok: false, error: detail, code: err.code };
  }
}
