/**
 * Heartbeat — Single entry point for Vercel cron.
 * Dispatches to daily or weekly based on CRON_SCHEDULE / request.
 * Run locally: npx tsx scheduler/heartbeat.ts [daily|weekly]
 */

import { runResearchCycle } from '@/agents/researcher';
import { runIdeaGenerationCycle } from '@/agents/ideaGenerator';
import { runSwarmCycle } from '@/agents/swarm';
import { runDailyWriting } from '@/agents/writer';
import { runEngagerCycle } from '@/agents/engager';
import { runNetworkerCycle } from '@/agents/networker';
import { runWeeklyWriting } from '@/agents/writer';
import { runReflectionCycle } from '@/agents/reflector';

export type HeartbeatMode = 'daily' | 'weekly';

export async function runDaily(): Promise<Record<string, unknown>> {
  const research = await runResearchCycle();
  const ideas = await runIdeaGenerationCycle();
  const swarm = await runSwarmCycle(5);
  const writing = await runDailyWriting();
  const context = `Recent ideas: ${ideas.count}. Research items: ${research.saved}.`;
  const networker = await runNetworkerCycle(context);
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
  const writing = await runWeeklyWriting();
  const reflection = await runReflectionCycle(7);
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
