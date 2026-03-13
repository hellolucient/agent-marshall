import { NextResponse } from 'next/server';
import { DASHBOARD_COOKIE } from '@/lib/dashboard-auth';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DASHBOARD_COOKIE, '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });
  return res;
}
