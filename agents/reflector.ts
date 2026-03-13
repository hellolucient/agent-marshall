/**
 * Reflector Agent — Weekly analysis: engagement, topic performance, reply effectiveness, audience growth.
 * Store reflection summaries in Supabase.
 */

import { complete } from '@/lib/llm';
import { loadIdentity } from '@/lib/templates';
import { supabase } from '@/lib/supabase';

export type ReflectionSummary = {
  period_start: string;
  period_end: string;
  summary: string;
  tweet_engagement_notes: string;
  topic_performance_notes: string;
  reply_effectiveness_notes: string;
  audience_growth_notes: string;
};

async function getPublishedInPeriod(start: Date, end: Date): Promise<{ count: number; types: Record<string, number> }> {
  const { data, error } = await supabase
    .from('published_posts')
    .select('platform, draft_post_id')
    .gte('published_at', start.toISOString())
    .lte('published_at', end.toISOString());
  if (error) throw error;
  const types: Record<string, number> = {};
  for (const row of data ?? []) {
    types[row.platform] = (types[row.platform] ?? 0) + 1;
  }
  return { count: (data ?? []).length, types };
}

async function getDraftsInPeriod(start: Date, end: Date): Promise<{ tweets: number; threads: number; replies: number }> {
  const { data, error } = await supabase
    .from('draft_posts')
    .select('draft_type')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());
  if (error) throw error;
  const out = { tweets: 0, threads: 0, replies: 0 };
  for (const row of data ?? []) {
    if (row.draft_type === 'tweet') out.tweets++;
    if (row.draft_type === 'thread') out.threads++;
    if (row.draft_type === 'reply') out.replies++;
  }
  return out;
}

export async function runReflectionCycle(periodDays = 7): Promise<ReflectionSummary> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - periodDays);
  const period_start = start.toISOString().slice(0, 10);
  const period_end = end.toISOString().slice(0, 10);

  const published = await getPublishedInPeriod(start, end);
  const drafts = await getDraftsInPeriod(start, end);

  const identity = loadIdentity();
  const system = `${identity}\n\nYou are writing a brief weekly reflection for Marshall's operator. Summarize in 2-4 sentences each: tweet engagement (what seemed to land), topic performance (which themes got response), reply effectiveness (did replies add value), audience growth (any signals). Be concise and actionable.`;
  const user = `Period: ${period_start} to ${period_end}\nPublished: ${published.count} (${JSON.stringify(published.types)})\nDrafts created: tweets ${drafts.tweets}, threads ${drafts.threads}, replies ${drafts.replies}.\nNo raw metrics are provided; infer from volume and suggest what to watch. Output four short paragraphs with headers: Tweet engagement; Topic performance; Reply effectiveness; Audience growth.`;

  const raw = await complete(
    [{ role: 'system', content: system }, { role: 'user', content: user }],
    { temperature: 0.4 }
  );

  const tweetEngagement = raw.match(/Tweet engagement[\s\S]*?(?=Topic performance|$)/i)?.[0]?.trim() ?? raw.slice(0, 300);
  const topicPerf = raw.match(/Topic performance[\s\S]*?(?=Reply effectiveness|$)/i)?.[0]?.trim() ?? '';
  const replyEff = raw.match(/Reply effectiveness[\s\S]*?(?=Audience growth|$)/i)?.[0]?.trim() ?? '';
  const audienceGrowth = raw.match(/Audience growth[\s\S]*$/i)?.[0]?.trim() ?? '';

  const summary = `Week ${period_start}–${period_end}: ${published.count} posts published. ${raw.slice(0, 200)}...`;

  const reflection: ReflectionSummary = {
    period_start,
    period_end,
    summary,
    tweet_engagement_notes: tweetEngagement,
    topic_performance_notes: topicPerf,
    reply_effectiveness_notes: replyEff,
    audience_growth_notes: audienceGrowth,
  };

  await supabase.from('reflection_notes').insert({
    period_start: reflection.period_start,
    period_end: reflection.period_end,
    summary: reflection.summary,
    tweet_engagement_notes: reflection.tweet_engagement_notes,
    topic_performance_notes: reflection.topic_performance_notes,
    reply_effectiveness_notes: reflection.reply_effectiveness_notes,
    audience_growth_notes: reflection.audience_growth_notes,
    metadata: { published, drafts },
  });

  return reflection;
}
