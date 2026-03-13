import { NextResponse } from 'next/server';
import { twitterResearchConfigured } from '@/agents/twitterResearch';

export const dynamic = 'force-dynamic';

/** Safe diagnostics (no secrets). Why Reply targets might be empty. */
export async function GET() {
  const { xKeysOk, queriesOk, queryCount } = twitterResearchConfigured();
  const hints: string[] = [];
  if (!xKeysOk) {
    hints.push(
      'Set all four: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET in .env — then restart dev server (npm run dev).'
    );
  }
  if (!queriesOk) {
    hints.push(
      'Set RESEARCH_TWITTER_QUERIES in .env (comma-separated searches, no comma inside a single query). Restart dev server.'
    );
  }
  if (xKeysOk && queriesOk) {
    hints.push(
      'Click Refresh Twitter hits. If you still get 0 rows, X often returns 403 on free tier — recent search needs Basic (or higher). Check the red error after refresh.'
    );
  }
  const cfg = twitterResearchConfigured();
  return NextResponse.json({
    xKeysOk,
    queriesOk,
    queryCount,
    queriesThisRun: cfg.queriesThisRun,
    ready: xKeysOk && queriesOk,
    hints: [
      ...hints,
      `Each refresh runs ${cfg.queriesThisRun} search(es) × up to ${process.env.RESEARCH_TWITTER_MAX_PER_QUERY ?? '10'} tweets (default) — keep small to save credits.`,
    ],
  });
}
