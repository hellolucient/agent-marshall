import { NextResponse } from 'next/server';
import { runDaily } from '@/scheduler/heartbeat';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await runDaily();
    return NextResponse.json(result);
  } catch (e) {
    console.error('Cron daily failed', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
