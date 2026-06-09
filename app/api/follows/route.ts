import { NextResponse } from 'next/server';
import { unstable_noStore } from 'next/cache';
import { supabase } from '@/lib/supabase';
import { enrichFollowRows } from '@/lib/xProfile';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: Request) {
  unstable_noStore();
  const { searchParams } = new URL(request.url);
  const accountStatus =
    searchParams.get('accountStatus')?.trim() ?? searchParams.get('status')?.trim();
  const enrich = searchParams.get('enrich') !== '0';
  const forceRefresh = searchParams.get('refresh') === '1';

  const { data, error } = await supabase
    .from('followed_accounts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows =
    accountStatus && accountStatus !== 'all'
      ? (data ?? []).filter((row) => row.status === accountStatus)
      : (data ?? []);

  if (enrich && rows.length > 0) {
    const enriched = await enrichFollowRows(
      rows.map((row) => ({
        id: row.id,
        handle: row.handle,
        account_id: row.account_id,
        metadata: (row.metadata as Record<string, unknown>) ?? {},
      })),
      { forceRefresh }
    );

    for (const item of enriched) {
      if (!item.profile) continue;
      const row = rows.find((r) => r.id === item.id);
      if (!row) continue;
      const meta: Record<string, unknown> = {
        ...((row.metadata as Record<string, unknown>) ?? {}),
        profile: item.profile,
      };
      if (item.metadata.x_name) meta.x_name = item.metadata.x_name;
      await supabase
        .from('followed_accounts')
        .update({
          account_id: item.account_id ?? row.account_id,
          metadata: meta,
        })
        .eq('id', item.id);
      row.metadata = meta;
      if (item.account_id) row.account_id = item.account_id;
    }

    rows = rows.map((row) => {
      const e = enriched.find((x) => x.id === row.id);
      return {
        ...row,
        profile: e?.profile ?? (row.metadata as { profile?: unknown })?.profile ?? null,
      };
    });
  }

  return NextResponse.json(rows, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
      'X-Follow-Count': String(rows.length),
    },
  });
}
