/**
 * Networker Agent — Identify relevant accounts Marshall should follow.
 * 3–5 recommendations per day; prefers real authors from recent X research, validated via API.
 */

import { complete } from '@/lib/llm';
import { loadIdentity } from '@/lib/templates';
import { supabase } from '@/lib/supabase';
import { lookupXUser } from '@/lib/xClient';

export type AccountRecommendation = {
  handle: string;
  display_name?: string;
  reason: string;
  topic_overlap?: string;
  account_id?: string;
};

const MAX_RECOMMENDATIONS_PER_DAY = 5;

function normHandle(h: string) {
  return h.trim().toLowerCase().replace(/^@/, '');
}

export async function getAlreadyRecommendedHandles(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('followed_accounts')
    .select('handle')
    .in('status', ['recommended', 'followed', 'dismissed']);
  if (error) throw error;
  return new Set((data ?? []).map((r) => normHandle(r.handle)));
}

type TwitterAuthorCandidate = {
  handle: string;
  sample: string;
};

function handleFromSourceUrl(url: string | null | undefined): string {
  if (!url) return '';
  const m = url.match(/x\.com\/([A-Za-z0-9_]{1,15})\/status\//i);
  return m ? normHandle(m[1]) : '';
}

/** Real @handles from recent Twitter research rows (not LLM-invented). */
export async function getRecentTwitterAuthorCandidates(limit = 40): Promise<TwitterAuthorCandidate[]> {
  const { data, error } = await supabase
    .from('research_items')
    .select('title, summary, metadata, source_url')
    .eq('source_type', 'twitter')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const byHandle = new Map<string, string>();
  for (const row of data ?? []) {
    const meta = row.metadata as Record<string, unknown> | null;
    const handle =
      normHandle(String(meta?.surfaceAuthor ?? '')) ||
      handleFromSourceUrl(row.source_url as string | undefined);
    if (!handle || handle === 'i') continue;
    if (!byHandle.has(handle)) {
      const sample = String(row.summary ?? row.title ?? '').slice(0, 200);
      byHandle.set(handle, sample);
    }
  }
  return Array.from(byHandle.entries()).map(([handle, sample]) => ({ handle, sample }));
}

function parseRecommendationLines(raw: string): AccountRecommendation[] {
  const recs: AccountRecommendation[] = [];
  for (const line of raw.split('\n').filter((l) => l.includes('|'))) {
    const parts = line.split('|').map((p) => p.trim());
    const handle = normHandle(parts[0]?.replace(/^@/, '') ?? '');
    if (!handle) continue;
    recs.push({
      handle,
      display_name: parts[1],
      reason: parts[2] ?? 'Relevant to Marshall\'s themes',
    });
  }
  return recs;
}

async function validateAndEnrich(rec: AccountRecommendation): Promise<AccountRecommendation | null> {
  const user = await lookupXUser(rec.handle);
  if (!user) {
    console.warn(`[networker] Skipping @${rec.handle} — not found on X`);
    return null;
  }
  return {
    ...rec,
    handle: user.username,
    display_name: user.name || rec.display_name,
    account_id: user.id,
    topic_overlap: user.description?.slice(0, 200),
  };
}

export async function recommendAccountsFromContext(context: string): Promise<AccountRecommendation[]> {
  const identity = loadIdentity();
  const seen = await getAlreadyRecommendedHandles();
  const candidates = await getRecentTwitterAuthorCandidates();
  const pool = candidates.filter((c) => !seen.has(c.handle));

  const baseRules = `${identity}

You are suggesting X accounts for Marshall to follow and engage with.
Marshall is a practical AI writer — not an academic.
TARGET: Mainstream AI enthusiasts, creators, practitioners (ChatGPT, Claude, tools, workflows).
PREFER: ~10k–500k followers, active conversation.
AVOID: Academics, AI safety theorists, mega-CEOs, jargon-only accounts.

CRITICAL: Only recommend handles that exist on X. Never invent or guess usernames.

Output 3-5 lines:
@handle | Display Name | One sentence reason`;

  const validated: AccountRecommendation[] = [];
  const allowed = new Set(pool.map((c) => c.handle));

  if (pool.length > 0) {
    const pickCount = Math.min(MAX_RECOMMENDATIONS_PER_DAY, pool.length);
    const candidateList = pool
      .map((c) => `@${c.handle} — recent post: "${c.sample.slice(0, 120)}${c.sample.length > 120 ? '…' : ''}"`)
      .join('\n');
    const system = `${baseRules}

You MUST pick only from this verified list of real accounts seen in recent X research:
${candidateList}`;
    const user = `Context: ${context}\n\nPick exactly ${pickCount} account(s) from the list above (best fit for Marshall). Do not add handles not in the list.`;
    const raw = await complete(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      { temperature: 0.3 }
    );

    for (const rec of parseRecommendationLines(raw)) {
      if (seen.has(rec.handle)) continue;
      if (!allowed.has(rec.handle)) {
        console.warn(`[networker] Skipping @${rec.handle} — not in research pool`);
        continue;
      }
      const enriched = await validateAndEnrich(rec);
      if (enriched) validated.push(enriched);
      if (validated.length >= MAX_RECOMMENDATIONS_PER_DAY) break;
    }

    if (validated.length === 0) {
      for (const c of pool.slice(0, MAX_RECOMMENDATIONS_PER_DAY)) {
        const enriched = await validateAndEnrich({
          handle: c.handle,
          reason: `Active in your recent X search: "${c.sample.slice(0, 100)}${c.sample.length > 100 ? '…' : ''}"`,
        });
        if (enriched) validated.push(enriched);
      }
    }
  } else {
    const system = `${baseRules}

No recent X research pool available. If you cannot name accounts you are certain exist, output fewer lines rather than guessing.`;
    const user = `Context: ${context}\n\nList up to 3-5 account recommendations (only real, well-known handles):`;
    const raw = await complete(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      { temperature: 0.2 }
    );
    for (const rec of parseRecommendationLines(raw)) {
      if (seen.has(rec.handle)) continue;
      const enriched = await validateAndEnrich(rec);
      if (enriched) validated.push(enriched);
      if (validated.length >= MAX_RECOMMENDATIONS_PER_DAY) break;
    }
  }

  return validated;
}

export async function saveRecommendation(rec: AccountRecommendation): Promise<string> {
  const { data, error } = await supabase
    .from('followed_accounts')
    .insert({
      platform: 'x',
      account_id: rec.account_id ?? null,
      handle: rec.handle,
      display_name: rec.display_name ?? null,
      bio: rec.topic_overlap ?? null,
      recommendation_reason: rec.reason,
      status: 'recommended',
      metadata: rec.topic_overlap ? { topic_overlap: rec.topic_overlap } : {},
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function countRecommendationsToday(): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from('followed_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'recommended')
    .gte('created_at', start.toISOString());
  if (error) throw error;
  return count ?? 0;
}

/** Run networker cycle: generate and save up to 5 recommendations. */
export async function runNetworkerCycle(context: string): Promise<{ recommended: number; skipped_invalid?: number }> {
  const existing = await countRecommendationsToday();
  const remaining = Math.max(0, MAX_RECOMMENDATIONS_PER_DAY - existing);
  if (remaining === 0) return { recommended: 0 };
  const recs = await recommendAccountsFromContext(context);
  let recommended = 0;
  for (const rec of recs.slice(0, remaining)) {
    try {
      await saveRecommendation(rec);
      recommended++;
    } catch (e) {
      console.error('Networker save failed', e);
    }
  }
  return { recommended };
}
