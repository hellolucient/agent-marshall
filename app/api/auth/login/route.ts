import { NextResponse } from 'next/server';
import {
  createDashboardToken,
  DASHBOARD_COOKIE,
  dashboardAuthConfigured,
} from '@/lib/dashboard-auth';

export async function POST(request: Request) {
  if (!dashboardAuthConfigured()) {
    return NextResponse.json(
      { error: 'DASHBOARD_PASSWORD not set — add it in env to enable login' },
      { status: 503 }
    );
  }
  let body: { password?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON body required' }, { status: 400 });
  }
  if (body.password !== process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }
  const token = createDashboardToken();
  if (!token) {
    return NextResponse.json({ error: 'Could not create session' }, { status: 500 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DASHBOARD_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
