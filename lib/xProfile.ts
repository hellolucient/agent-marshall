/**
 * X user profile stats + "followed by people you follow" for follow suggestions.
 */
import { getXReadWrite } from '@/lib/xClient';

export type XProfileStats = {
  joined_at?: string;
  followers_count?: number;
  following_count?: number;
  tweet_count?: number;
  /** How many accounts you follow also follow this user (sampled from recent followers). */
  followed_by_following_count?: number;
  followed_by_following_sample?: string[];
  profile_fetched_at?: string;
  profile_partial?: boolean;
};

export type XProfileEnriched = XProfileStats & {
  id: string;
  username: string;
  name: string;
  description?: string;
};

const MY_FOLLOWING_CACHE_MS = 30 * 60 * 1000;
const PROFILE_CACHE_MS = 6 * 60 * 60 * 1000;
const MAX_FOLLOWERS_SCAN = 500;

let myFollowingCache: {
  ids: Set<string>;
  at: number;
} | null = null;

function profileFromMetadata(meta: Record<string, unknown> | null | undefined): XProfileStats | null {
  const p = meta?.profile;
  if (!p || typeof p !== 'object') return null;
  const prof = p as XProfileStats;
  if (!prof.profile_fetched_at) return null;
  const age = Date.now() - new Date(prof.profile_fetched_at).getTime();
  if (age > PROFILE_CACHE_MS) return null;
  return prof;
}

async function getMyFollowingIds(): Promise<Set<string>> {
  if (myFollowingCache && Date.now() - myFollowingCache.at < MY_FOLLOWING_CACHE_MS) {
    return myFollowingCache.ids;
  }
  const client = getXReadWrite();
  if (!client) return new Set();

  try {
    const me = await client.v2.me();
    const ids = new Set<string>();
    let paginationToken: string | undefined;
    let pages = 0;
    while (pages < 15) {
      const res = await client.v2.following(me.data.id, {
        max_results: 1000,
        pagination_token: paginationToken,
        'user.fields': ['username'],
      });
      for (const user of res.data ?? []) {
        ids.add(user.id);
      }
      paginationToken = res.meta?.next_token;
      pages++;
      if (!paginationToken) break;
    }
    myFollowingCache = { ids, at: Date.now() };
    return ids;
  } catch (e) {
    console.warn('[xProfile] Could not load your following list', e);
    return new Set();
  }
}

async function countFollowedByMyFollowing(
  targetUserId: string,
  myFollowingIds: Set<string>
): Promise<{ count: number; sample: string[]; partial: boolean }> {
  const client = getXReadWrite();
  if (!client || myFollowingIds.size === 0) {
    return { count: 0, sample: [], partial: false };
  }

  const sample: string[] = [];
  let count = 0;
  let scanned = 0;
  let partial = false;

  try {
    let paginationToken: string | undefined;
    while (scanned < MAX_FOLLOWERS_SCAN) {
      const res = await client.v2.followers(targetUserId, {
        max_results: 100,
        pagination_token: paginationToken,
        'user.fields': ['username'],
      });
      for (const user of res.data ?? []) {
        scanned++;
        if (myFollowingIds.has(user.id)) {
          count++;
          if (sample.length < 3 && user.username) sample.push(user.username);
        }
        if (scanned >= MAX_FOLLOWERS_SCAN) break;
      }
      paginationToken = res.meta?.next_token;
      if (!paginationToken || scanned >= MAX_FOLLOWERS_SCAN) {
        if (paginationToken && scanned >= MAX_FOLLOWERS_SCAN) partial = true;
        break;
      }
    }
  } catch (e) {
    console.warn('[xProfile] followers lookup failed for', targetUserId, e);
    return { count: 0, sample: [], partial: true };
  }

  return { count, sample, partial };
}

/** Fetch profile + mutual-follower signal for one @handle. */
export async function fetchXProfileForHandle(
  username: string,
  options?: { skipMutual?: boolean }
): Promise<XProfileEnriched | null> {
  const client = getXReadWrite();
  if (!client) return null;
  const handle = username.trim().replace(/^@/, '');
  if (!handle) return null;

  try {
    const { data } = await client.v2.userByUsername(handle, {
      'user.fields': ['created_at', 'public_metrics', 'description', 'name', 'username'],
    });
    if (!data) return null;

    const base: XProfileEnriched = {
      id: data.id,
      username: data.username,
      name: data.name,
      description: data.description,
      joined_at: data.created_at,
      followers_count: data.public_metrics?.followers_count,
      following_count: data.public_metrics?.following_count,
      tweet_count: data.public_metrics?.tweet_count,
      profile_fetched_at: new Date().toISOString(),
    };

    if (!options?.skipMutual) {
      const myFollowing = await getMyFollowingIds();
      const mutual = await countFollowedByMyFollowing(data.id, myFollowing);
      base.followed_by_following_count = mutual.count;
      base.followed_by_following_sample = mutual.sample;
      base.profile_partial = mutual.partial;
    }

    return base;
  } catch (e) {
    console.warn('[xProfile] user lookup failed for', handle, e);
    return null;
  }
}

export type FollowRowWithProfile = {
  id: string;
  handle: string;
  account_id: string | null;
  metadata: Record<string, unknown>;
  profile?: XProfileStats;
};

/** Enrich follow rows from X API; reuse cached metadata when fresh. */
export async function enrichFollowRows(
  rows: FollowRowWithProfile[],
  options?: { forceRefresh?: boolean }
): Promise<FollowRowWithProfile[]> {
  if (rows.length === 0) return rows;

  const out: FollowRowWithProfile[] = [];

  for (const row of rows) {
    if (!options?.forceRefresh) {
      const cached = profileFromMetadata(row.metadata);
      if (cached) {
        out.push({ ...row, profile: cached });
        continue;
      }
    }

    const profile = await fetchXProfileForHandle(row.handle);
    if (profile) {
      const { id: _x, username: _u, name: _n, description: _d, ...stats } = profile;
      out.push({
        ...row,
        account_id: row.account_id ?? profile.id,
        profile: stats,
        metadata: {
          ...row.metadata,
          profile: stats,
          x_name: profile.name,
        },
      });
    } else {
      const cached = profileFromMetadata(row.metadata);
      out.push({ ...row, profile: cached ?? undefined });
    }
  }

  return out;
}

