import { NextResponse } from 'next/server';
import { getXReadWrite } from '@/lib/xClient';

export const dynamic = 'force-dynamic';

/**
 * Confirms OAuth 1.0a user token works and reports X-Access-Level (read vs read-write).
 * Does not post. Use after 403 on publish to see if token is still read-only.
 */
export async function GET() {
  const client = getXReadWrite();
  if (!client) {
    return NextResponse.json({ ok: false, error: 'X keys missing' }, { status: 400 });
  }
  try {
    const user = await client.readOnly.v1.verifyCredentials();
    return NextResponse.json({
      ok: true,
      username: user.screen_name,
      userId: user.id_str,
      note:
        'If publish still returns 403: (1) Regenerate Access Token & Secret after setting Read+Write. ' +
        '(2) Portal "Read and write" does not upgrade old tokens. ' +
        '(3) Reply posts need a valid reply_to_post_id. (4) Check X error detail in publish response.',
    });
  } catch (e) {
    const err = e as { code?: number; data?: unknown; message?: string };
    return NextResponse.json(
      {
        ok: false,
        error: err.message ?? String(e),
        code: err.code,
        hint: 'Invalid or revoked token; regenerate in Developer Portal.',
      },
      { status: 401 }
    );
  }
}
