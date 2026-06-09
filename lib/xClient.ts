/**
 * X (Twitter) API v2 — user context OAuth 1.0a. Used for publish + search elsewhere.
 */
import { TwitterApi } from 'twitter-api-v2';

export function hasFullXCredentials(): boolean {
  return Boolean(
    process.env.X_API_KEY &&
      process.env.X_API_SECRET &&
      process.env.X_ACCESS_TOKEN &&
      process.env.X_ACCESS_TOKEN_SECRET
  );
}

export function getXReadWrite(): TwitterApi | null {
  if (!hasFullXCredentials()) return null;
  return new TwitterApi({
    appKey: process.env.X_API_KEY!,
    appSecret: process.env.X_API_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN!,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET!,
  });
}

export type XUserLookup = {
  id: string;
  username: string;
  name: string;
  followers_count?: number;
  description?: string;
};

/** Resolve @handle → user. Returns null if account does not exist or lookup fails. */
export async function lookupXUser(username: string): Promise<XUserLookup | null> {
  const client = getXReadWrite();
  if (!client) return null;
  const handle = username.trim().replace(/^@/, '');
  if (!handle) return null;
  try {
    const { data } = await client.readOnly.v2.userByUsername(handle, {
      'user.fields': ['name', 'username', 'public_metrics', 'description'],
    });
    if (!data) return null;
    return {
      id: data.id,
      username: data.username,
      name: data.name,
      followers_count: data.public_metrics?.followers_count,
      description: data.description,
    };
  } catch {
    return null;
  }
}
