import { NextResponse } from 'next/server';
import { runDaily, runWeekly } from '@/scheduler/heartbeat';
import {
  DASHBOARD_COOKIE,
  dashboardAuthConfigured,
  parseCookieHeader,
  verifyDashboardToken,
} from '@/lib/dashboard-auth';

export const dynamic = 'force-dynamic';
/** Daily heartbeat can run many minutes (swarm). Match or exceed Vercel plan limit. */
export const maxDuration = 300;

function authorized(request: Request, bodySecret?: string): boolean {
  const cookies = parseCookieHeader(request.headers.get('cookie'));
  const sessionOk = verifyDashboardToken(cookies[DASHBOARD_COOKIE]);
  const cronSecret = process.env.CRON_SECRET;
  const bearer = request.headers.get('authorization');
  const cronOk =
    !!cronSecret &&
    (bearer === `Bearer ${cronSecret}` || bodySecret === cronSecret);

  if (dashboardAuthConfigured()) {
    return sessionOk || cronOk;
  }
  if (cronSecret) return cronOk;
  return true;
}

/**
 * Manual heartbeat (same work as cron).
 * POST JSON: { "mode": "daily" | "weekly", "secret"?: string }
 * If CRON_SECRET is set: send secret in body or Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: Request) {
  let body: { mode?: string; secret?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON body required' }, { status: 400 });
  }

  if (!authorized(request, body.secret)) {
    return NextResponse.json(
      {
        error:
          'Unauthorized — sign in at /login (DASHBOARD_PASSWORD), or send CRON_SECRET as Bearer for scripts',
      },
      { status: 401 }
    );
  }

  const mode = body.mode === 'weekly' ? 'weekly' : body.mode === 'daily' ? 'daily' : null;
  if (!mode) {
    return NextResponse.json({ error: 'mode must be "daily" or "weekly"' }, { status: 400 });
  }

  try {
    const result = mode === 'daily' ? await runDaily() : await runWeekly();
    return NextResponse.json({ ok: true, mode, result });
  } catch (e) {
    console.error('Manual heartbeat failed', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
