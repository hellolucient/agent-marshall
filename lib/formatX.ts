export type XProfileDisplay = {
  joined_at?: string;
  followers_count?: number;
  following_count?: number;
  tweet_count?: number;
  followed_by_following_count?: number;
  followed_by_following_sample?: string[];
  profile_partial?: boolean;
};

export function xProfileUrl(handle: string): string {
  return `https://x.com/${handle.replace(/^@/, '')}`;
}

export function formatCount(n: number | undefined): string {
  if (n === undefined || n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

export function formatJoinedDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

export function formatFollowedByFollowing(profile: XProfileDisplay | undefined | null): string | null {
  if (!profile || profile.followed_by_following_count === undefined) return null;
  const n = profile.followed_by_following_count;
  const sample = profile.followed_by_following_sample ?? [];
  const suffix = profile.profile_partial ? ' (sampled)' : '';
  if (n === 0) return `None of the accounts you follow follow them${suffix}`;
  const names = sample.map((h) => `@${h}`);
  if (n === 1 && names[0]) return `Followed by ${names[0]} you follow${suffix}`;
  if (n === 2 && names.length >= 2) return `Followed by ${names[0]} and ${names[1]} you follow${suffix}`;
  if (names.length >= 1) {
    const rest = n - 1;
    return `Followed by ${names[0]} and ${rest} other${rest === 1 ? '' : 's'} you follow${suffix}`;
  }
  return `Followed by ${n} account${n === 1 ? '' : 's'} you follow${suffix}`;
}
