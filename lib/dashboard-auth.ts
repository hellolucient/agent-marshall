import crypto from 'crypto';
import { DASHBOARD_COOKIE } from './dashboard-auth-config';

export { DASHBOARD_COOKIE };
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  return process.env.DASHBOARD_PASSWORD ?? '';
}

export function dashboardAuthConfigured(): boolean {
  return Boolean(process.env.DASHBOARD_PASSWORD?.length);
}

/** Signed token: payload (base64url JSON { exp }) . hmac */
export function createDashboardToken(): string | null {
  const pwd = secret();
  if (!pwd) return null;
  const exp = Date.now() + MAX_AGE_SEC * 1000;
  const payload = Buffer.from(JSON.stringify({ exp }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', pwd).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyDashboardToken(token: string | undefined | null): boolean {
  if (!token || !secret()) return false;
  const i = token.lastIndexOf('.');
  if (i <= 0) return false;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  } catch {
    return false;
  }
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp: number };
    return typeof exp === 'number' && exp > Date.now();
  } catch {
    return false;
  }
}

export function parseCookieHeader(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k) out[k] = decodeURIComponent(rest.join('=').trim());
  }
  return out;
}
