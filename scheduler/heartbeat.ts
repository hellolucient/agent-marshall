/**
 * Heartbeat — Single entry point for Vercel cron.
 * Dispatches to daily or weekly based on CRON_SCHEDULE / request.
 * Run locally: npm run cron:heartbeat daily|weekly
 * Loads .env so Supabase/OpenAI match `npm run dev` (tsx does not load .env by default).
 */
import 'dotenv/config';

import { runResearchCycle } from '@/agents/researcher';
import { runIdeaGenerationCycle } from '@/agents/ideaGenerator';
import { runSwarmCycle } from '@/agents/swarm';
import { runDailyWriting } from '@/agents/writer';
import { runNetworkerCycle } from '@/agents/networker';
import { runWeeklyWriting } from '@/agents/writer';
import { runReflectionCycle } from '@/agents/reflector';

export type HeartbeatMode = 'daily' | 'weekly';

function log(msg: string) {
  const t = new Date().toISOString().slice(11, 19);
  process.stderr.write(`[heartbeat ${t}] ${msg}\n`);
}

export async function runDaily(): Promise<Record<string, unknown>> {
  const swarmLimit = Math.max(
    1,
    Math.min(20, parseInt(process.env.HEARTBEAT_SWARM_LIMIT ?? '5', 10) || 5)
  );
  log('Starting daily run…');
  log('(Swarm is slow: each idea runs 5 LLM roles in series — can be many minutes.)');
  log(`Swarm limit this run: ${swarmLimit} ideas (must be ≥ daily tweet draft count; set HEARTBEAT_SWARM_LIMIT)`);

  log('1/5 Research (RSS; Twitter only if RESEARCH_TWITTER_ON_HEARTBEAT=true)…');
  const research = await runResearchCycle();
  log(
    `   research saved: ${research.saved}` +
      (research.rss !== undefined ? ` (rss ${research.rss}, twitter ${research.twitter})` : '')
  );
  if (process.env.RESEARCH_TWITTER_ON_HEARTBEAT !== 'true') {
    log('   (Twitter skipped on heartbeat — use Reply targets → Refresh to pull tweets.)');
  }

  log('2/5 Idea generation (1 LLM call)…');
  const ideas = await runIdeaGenerationCycle();
  log(`   ideas inserted: ${ideas.count}`);

  log(`3/5 Swarm (up to ${swarmLimit} ideas × 5 roles — wait…)…`);
  const swarm = await runSwarmCycle(swarmLimit);
  log(`   swarm scored: ${swarm.processed}`);

  log('4/5 Daily writing (tweet drafts)…');
  const writing = await runDailyWriting();
  log(`   tweet drafts: ${writing.tweets}`);

  log('5/5 Networker (follow suggestions)…');
  const context = `Recent ideas: ${ideas.count}. Research items: ${research.saved}.`;
  const networker = await runNetworkerCycle(context);
  log(`   follow suggestions: ${networker.recommended}`);
  log('Daily run finished.');
  return {
    research: research.saved,
    ideas: ideas.count,
    swarm: swarm.processed,
    tweets: writing.tweets,
    networker: networker.recommended,
    note: 'Reply drafting requires discussion context; run engager via API with payload.',
  };
}

export async function runWeekly(): Promise<Record<string, unknown>> {
  log('Starting weekly run…');
  log('1/2 Weekly writing (thread + Substack outline)…');
  const writing = await runWeeklyWriting();
  log('2/2 Reflection…');
  const reflection = await runReflectionCycle(7);
  log('Weekly run finished.');
  return {
    thread: writing.thread,
    substack: writing.substack,
    reflection: reflection.period_end,
  };
}

async function main() {
  const mode = (process.argv[2] ?? 'daily') as HeartbeatMode;
  if (mode === 'weekly') {
    const out = await runWeekly();
    console.log(JSON.stringify(out, null, 2));
  } else {
    const out = await runDaily();
    console.log(JSON.stringify(out, null, 2));
  }
}

const isDirectRun = process.argv[1]?.includes('heartbeat');
if (isDirectRun) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
