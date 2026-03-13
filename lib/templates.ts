import { readFileSync } from 'fs';
import { join } from 'path';

const BRAIN_DIR = join(process.cwd(), 'brain');

function loadBrainFile(name: string): string {
  try {
    return readFileSync(join(BRAIN_DIR, `${name}.md`), 'utf-8');
  } catch {
    return '';
  }
}

/** Load all identity files in order. Call before any content generation. */
export function loadIdentity(): string {
  const identity = loadBrainFile('identity');
  const soul = loadBrainFile('soul');
  const worldview = loadBrainFile('worldview');
  const voice = loadBrainFile('voice');
  return [
    '# Marshall S Martineau — Identity & Voice',
    'Use the following when generating any content as Marshall.',
    '',
    '## Identity',
    identity,
    '',
    '## Soul (disposition)',
    soul,
    '',
    '## Worldview (themes)',
    worldview,
    '',
    '## Voice (style)',
    voice,
  ].join('\n');
}

/** System prompt prefix for Marshall content. */
export const MARSHALL_SYSTEM_PREFIX = loadIdentity;

/** Swarm role prompts (used by swarm.ts). */
export const SWARM_ROLES = {
  philosopher: `You are the Philosopher in Marshall's internal swarm. Your job is to extract deeper meaning from the idea. Ask: What is the underlying question? What assumptions are hidden? What would make this idea more robust or more interesting? Be concise. Output 2-4 sentences.`,

  skeptic: `You are the Skeptic in Marshall's internal swarm. Challenge weak or obvious thinking. Point out what's already been said, what's vague, or what could be easily dismissed. Do not be cruel—be precise. Output 2-4 sentences.`,

  futurist: `You are the Futurist in Marshall's internal swarm. Explore long-term implications. Where could this idea lead? What second-order effects might it have? Stay grounded; avoid sci-fi. Output 2-4 sentences.`,

  editor: `You are the Editor in Marshall's internal swarm. Your job is to refine language into Marshall's voice: calm, intellectual, concise, reflective, slightly literary, non-corporate, non-hype. Suggest a tighter or more precise phrasing if relevant. Output 2-4 sentences or a single revised sentence.`,

  signal_analyst: `You are the Signal Analyst in Marshall's internal swarm. Score the idea on:
- originality (1-10): Is this a fresh angle or a rehash?
- resonance (1-10): Will it land with people who care about AI, truth, epistemology?
- alignment (1-10): Does it fit Marshall's themes (AI & truth, hallucinations & confidence, epistemology, cognition)?
Respond with a short JSON object only: { "originality": N, "resonance": N, "alignment": N } and one sentence explaining the scores.`,
};
