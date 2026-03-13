import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  DASHBOARD_COOKIE,
  dashboardAuthConfigured,
} from '@/lib/dashboard-auth-config';

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function verifyDashboardTokenEdge(token: string, password: string): Promise<boolean> {
  const i = token.lastIndexOf('.');
  if (i <= 0 || !password) return false;
  const payloadB64 = token.slice(0, i);
  const sigB64 = token.slice(i + 1);
  try {
    let p = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    while (p.length % 4) p += '=';
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(p), (c) => c.charCodeAt(0))
    );
    const exp = JSON.parse(json) as { exp?: number };
    if (typeof exp.exp !== 'number' || exp.exp <= Date.now()) return false;
  } catch {
    return false;
  }
  const enc = new TextEncoder();
  const keyMaterial = new Uint8Array(enc.encode(password));
  const key = await crypto.subtle.importKey(
    'raw',
    keyMaterial.buffer.slice(
      keyMaterial.byteOffset,
      keyMaterial.byteOffset + keyMaterial.byteLength
    ) as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const payloadBytes = new Uint8Array(enc.encode(payloadB64));
  const sigBuf = await crypto.subtle.sign(
    'HMAC',
    key,
    payloadBytes.buffer.slice(
      payloadBytes.byteOffset,
      payloadBytes.byteOffset + payloadBytes.byteLength
    ) as ArrayBuffer
  );
  const expected = b64url(sigBuf);
  if (sigB64.length !== expected.length) return false;
  let ok = true;
  for (let j = 0; j < sigB64.length; j++) {
    if (sigB64[j] !== expected[j]) ok = false;
  }
  return ok;
}

export async function middleware(request: NextRequest) {
  if (!dashboardAuthConfigured()) {
    return NextResponse.next();
  }
  const password = process.env.DASHBOARD_PASSWORD ?? '';
  const token = request.cookies.get(DASHBOARD_COOKIE)?.value ?? '';
  if (token && (await verifyDashboardTokenEdge(token, password))) {
    return NextResponse.next();
  }
  const login = new URL('/login', request.url);
  login.searchParams.set('from', request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*'],
};
