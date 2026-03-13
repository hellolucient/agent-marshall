/**
 * Scoring utilities for ideas and content.
 * Used by swarm (Signal Analyst) and reflector.
 */

export type IdeaScore = {
  originality: number; // 1-10
  resonance: number;   // 1-10, likely audience response
  alignment: number;  // 1-10, fit with Marshall's themes
};

export function aggregateScore(scores: Partial<IdeaScore>): number {
  const o = scores.originality ?? 5;
  const r = scores.resonance ?? 5;
  const a = scores.alignment ?? 5;
  return Math.round((o + r + a) / 3 * 100) / 100;
}

export function parseSwarmScores(raw: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'number' && v >= 0 && v <= 10) out[k] = v;
    if (typeof v === 'string') {
      const n = parseFloat(v);
      if (!Number.isNaN(n) && n >= 0 && n <= 10) out[k] = n;
    }
  }
  return out;
}
