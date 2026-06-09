import { NextResponse } from 'next/server';
import { unstable_noStore } from 'next/cache';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  unstable_noStore();
  const { searchParams } = new URL(request.url);
  // Avoid `status` query param — on Vercel it can break PostgREST column filters for this table.
  const accountStatus =
    searchParams.get('accountStatus')?.trim() ?? searchParams.get('status')?.trim();

  const { data, error } = await supabase
    .from('followed_accounts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows =
    accountStatus && accountStatus !== 'all'
      ? (data ?? []).filter((row) => row.status === accountStatus)
      : (data ?? []);

  return NextResponse.json(rows, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
      'X-Follow-Count': String(rows.length),
    },
  });
}
