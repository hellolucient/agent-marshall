/**
 * Idea Generator — Convert research + memory into candidate post ideas.
 * Generates at least 10 candidate ideas per cycle.
 */

import { complete } from '@/lib/llm';
import { loadIdentity } from '@/lib/templates';
import { supabase } from '@/lib/supabase';
import type { ResearchItem } from '@/lib/supabase';

const IDEAS_PER_CYCLE = 10;

export type CandidateIdea = {
  idea_text: string;
  idea_type: 'tweet' | 'thread' | 'substack' | 'reply';
  source_context?: string;
};

export async function getRecentResearch(limit = 30): Promise<ResearchItem[]> {
  const { data, error } = await supabase
    .from('research_items')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ResearchItem[];
}

export async function generateCandidateIdeas(): Promise<CandidateIdea[]> {
  const identity = loadIdentity();
  const research = await getRecentResearch();
  const researchBlob = research.length
    ? research.map((r) => `- ${r.title}\n  ${(r.summary ?? r.raw_content ?? '').slice(0, 500)}`).join('\n')
    : 'No recent research items. Draw from Marshall\'s themes: practical AI use, judgment over blind trust, hallucinations in context, AI in work and business, confident experimentation without hype or panic.';

  const system = `${identity}\n\nYou are generating candidate ideas for Marshall's content. Each idea should be a single sentence or short premise that could become a tweet, thread, or Substack piece. Ideas should be pragmatic, conversational, and useful to mainstream AI-curious professionals — not academic or dry. Be original; avoid listicles and empty hot takes.`;

  const user = `Recent research and context:\n${researchBlob}\n\nGenerate exactly ${IDEAS_PER_CYCLE} distinct candidate ideas. For each idea, decide if it's best as tweet, thread, or substack. Output in this format (one per line):\nTYPE | IDEA_TEXT\nExample:\ntweet | The problem isn't that AI hallucinates. It's that people treat the first answer like a finished product.\nthread | Everyone's debating whether AI is trustworthy. Wrong question. The question is whether your workflow includes judgment.\n\nOutput ${IDEAS_PER_CYCLE} lines now:`;

  const raw = await complete([{ role: 'system', content: system }, { role: 'user', content: user }], { temperature: 0.8 });
  const lines = raw.split('\n').filter((l) => l.trim());
  const ideas: CandidateIdea[] = [];
  for (const line of lines) {
    const match = line.match(/^(tweet|thread|substack|reply)\s*\|\s*(.+)$/i);
    if (match) {
      ideas.push({
        idea_type: match[1].toLowerCase() as CandidateIdea['idea_type'],
        idea_text: match[2].trim(),
      });
    }
  }
  return ideas.slice(0, IDEAS_PER_CYCLE);
}

export async function saveCandidateIdeas(ideas: CandidateIdea[], researchIds?: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const idea of ideas) {
    const { data, error } = await supabase
      .from('post_ideas')
      .insert({
        research_item_ids: researchIds ?? null,
        idea_text: idea.idea_text,
        idea_type: idea.idea_type,
        status: 'candidate',
        metadata: {},
      })
      .select('id')
      .single();
    if (error) throw error;
    ids.push(data.id);
  }
  return ids;
}

/** Full cycle: generate ideas and persist. */
export async function runIdeaGenerationCycle(): Promise<{ count: number }> {
  const ideas = await generateCandidateIdeas();
  const research = await getRecentResearch(20);
  const researchIds = research.map((r) => r.id);
  await saveCandidateIdeas(ideas, researchIds.length ? researchIds : undefined);
  return { count: ideas.length };
}
