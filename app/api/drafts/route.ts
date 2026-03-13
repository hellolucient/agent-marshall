import { NextResponse } from 'next/server';
import { unstable_noStore } from 'next/cache';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  unstable_noStore();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type')?.trim(); // tweet | thread | reply | substack_outline
  const status = searchParams.get('status')?.trim(); // draft | approved | published | rejected | all
  let q = supabase
    .from('draft_posts')
    .select('*')
    .neq('draft_type', 'reply')
    .order('created_at', { ascending: false });
  if (type && type !== 'reply') q = q.eq('draft_type', type);
  if (status && status !== 'all') q = q.eq('status', status);
  const limitParam = new URL(request.url).searchParams.get('limit');
  const limit = Math.min(500, Math.max(50, parseInt(limitParam ?? '250', 10) || 250));
  const { data, error } = await q.limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = Array.isArray(data) ? data : [];
  return NextResponse.json(rows, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
      'X-Draft-Count': String(rows.length),
    },
  });
}
