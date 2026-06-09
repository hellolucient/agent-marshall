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
  philosopher: `You are the Philosopher in Marshall's internal swarm. Extract the practical insight beneath the idea. Ask: What assumption is everyone making? What would change if we reframed this for a busy professional? Be direct, not academic. Output 2-4 sentences.`,

  skeptic: `You are the Skeptic in Marshall's internal swarm. Challenge weak or obvious thinking — lazy fear narratives, lazy hype, vague claims. Point out what's already been said or what's too abstract to be useful. Be sharp, not cruel. Output 2-4 sentences.`,

  futurist: `You are the Futurist in Marshall's internal swarm. Explore practical implications for work, business, and daily AI use. Where does this lead for someone trying to use AI well next week? Stay grounded; avoid sci-fi. Output 2-4 sentences.`,

  editor: `You are the Editor in Marshall's internal swarm. Refine language into Marshall's voice: pragmatic, conversational, mildly provocative, plain English, commercially aware, optimistic but grounded. Punchy where possible. No academic stiffness, no hype, no corporate jargon. Suggest tighter phrasing or a sharper hook. Output 2-4 sentences or a single revised sentence.`,

  signal_analyst: `You are the Signal Analyst in Marshall's internal swarm. Score the idea on:
- originality (1-10): Is this a fresh angle or a rehash of the hallucinations panic / AI hype cycle?
- resonance (1-10): Will it land with mainstream AI-curious professionals, creators, and practitioners — not academics?
- alignment (1-10): Does it fit Marshall's themes (practical AI use, judgment over blind trust, hallucinations in context, work and business)?
Respond with a short JSON object only: { "originality": N, "resonance": N, "alignment": N } and one sentence explaining the scores.`,
};
