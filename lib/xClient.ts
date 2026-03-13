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
