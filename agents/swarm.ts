/**
 * Swarm Agent — Run ideas through reasoning roles: Philosopher, Skeptic, Futurist, Editor, Signal Analyst.
 * Each role critiques/refines; Signal Analyst scores. Ideas are then rankable.
 */

import { complete, completeJson } from '@/lib/llm';
import { loadIdentity } from '@/lib/templates';
import { SWARM_ROLES } from '@/lib/templates';
import { supabase } from '@/lib/supabase';
import { aggregateScore, parseSwarmScores } from '@/lib/scoring';
import type { PostIdea } from '@/lib/supabase';

const ROLES = ['philosopher', 'skeptic', 'futurist', 'editor', 'signal_analyst'] as const;

export type SwarmResult = {
  idea_id: string;
  critiques: Record<string, string>;
  scores: Record<string, number>;
  aggregate_score: number;
  refined_idea?: string;
};

export async function runSwarmForIdea(idea: PostIdea): Promise<SwarmResult> {
  const identity = loadIdentity();
  const base = `Identity and voice (for context):\n${identity.slice(0, 3000)}\n\n---\nIdea to evaluate: "${idea.idea_text}" (type: ${idea.idea_type})`;
  const critiques: Record<string, string> = {};
  let scores: Record<string, number> = {};

  for (const role of ROLES) {
    const system = SWARM_ROLES[role as keyof typeof SWARM_ROLES];
    const content = await complete(
      [{ role: 'system', content: system }, { role: 'user', content: base }],
      { temperature: 0.5 }
    );
    if (role === 'signal_analyst') {
      const jsonMatch = content.match(/\{[\s\S]*"originality"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]) as Record<string, number>;
          scores = parseSwarmScores(parsed);
        } catch {
          scores = {};
        }
      }
      critiques[role] = content;
    } else {
      critiques[role] = content;
    }
  }

  const aggregate = aggregateScore({
    originality: scores.originality,
    resonance: scores.resonance,
    alignment: scores.alignment,
  });

  return {
    idea_id: idea.id,
    critiques,
    scores,
    aggregate_score: aggregate,
  };
}

export async function getUnscoredIdeas(limit = 20): Promise<PostIdea[]> {
  const { data, error } = await supabase
    .from('post_ideas')
    .select('*')
    .eq('status', 'candidate')
    .is('aggregate_score', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PostIdea[];
}

export async function saveSwarmResult(result: SwarmResult): Promise<void> {
  await supabase
    .from('post_ideas')
    .update({
      swarm_scores: result.scores,
      aggregate_score: result.aggregate_score,
      metadata: { critiques: result.critiques, refined_idea: result.refined_idea },
    })
    .eq('id', result.idea_id);
}

/** Run swarm on top N unscored ideas. */
export async function runSwarmCycle(limit = 5): Promise<{ processed: number }> {
  const ideas = await getUnscoredIdeas(limit);
  let processed = 0;
  for (const idea of ideas) {
    try {
      const result = await runSwarmForIdea(idea);
      await saveSwarmResult(result);
      processed++;
    } catch (e) {
      console.error('Swarm failed for idea', idea.id, e);
    }
  }
  return { processed };
}
