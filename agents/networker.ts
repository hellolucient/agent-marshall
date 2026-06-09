/**
 * Networker Agent — Identify relevant accounts Marshall should follow.
 * 3–5 recommendations per day; topic overlap, engagement quality, strategic relevance.
 */

import { complete } from '@/lib/llm';
import { loadIdentity } from '@/lib/templates';
import { supabase } from '@/lib/supabase';

export type AccountRecommendation = {
  handle: string;
  display_name?: string;
  reason: string;
  topic_overlap?: string;
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

export async function recommendAccountsFromContext(context: string): Promise<AccountRecommendation[]> {
  const identity = loadIdentity();
  const system = `${identity}\n\nYou are suggesting X accounts for Marshall to consider following and engaging with.

Marshall is a practical AI writer — not an academic. Suggest accounts Marshall could realistically reply to and learn from.

TARGET: Mainstream AI enthusiasts, creators, and practitioners who discuss consumer and professional AI in plain language — ChatGPT, Claude, image/video AI, productivity workflows, AI tools for business, practical experiments, what's actually working.

PREFER: Accounts roughly 10k–500k followers. Active posters with real conversation in replies.

AVOID: Academic researchers, university professors, epistemology/cognition specialists, AI safety theorists, big-name CEOs, mega-influencers Marshall couldn't meaningfully engage with, and accounts that only post papers or jargon.

Output 3-5 recommendations in this format, one per line:
@handle | Display Name | One sentence reason`;
  const user = `Context (recent discussions, topics, or research):\n${context}\n\nList 3-5 account recommendations:`;
  const raw = await complete(
    [{ role: 'system', content: system }, { role: 'user', content: user }],
    { temperature: 0.5 }
  );
  const lines = raw.split('\n').filter((l) => l.includes('|'));
  const recs: AccountRecommendation[] = [];
  const seen = await getAlreadyRecommendedHandles();
  for (const line of lines) {
    const parts = line.split('|').map((p) => p.trim());
    const handle = (parts[0]?.replace(/^@/, '') ?? '').trim().toLowerCase();
    if (!handle || seen.has(handle)) continue;
    recs.push({
      handle,
      display_name: parts[1],
      reason: parts[2] ?? 'Relevant to Marshall\'s themes',
    });
    if (recs.length >= MAX_RECOMMENDATIONS_PER_DAY) break;
  }
  return recs;
}

export async function saveRecommendation(rec: AccountRecommendation): Promise<string> {
  const { data, error } = await supabase
    .from('followed_accounts')
    .insert({
      platform: 'x',
      handle: rec.handle,
      display_name: rec.display_name ?? null,
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
export async function runNetworkerCycle(context: string): Promise<{ recommended: number }> {
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
