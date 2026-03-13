import { NextResponse } from 'next/server';
import { unstable_noStore } from 'next/cache';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  unstable_noStore();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status')?.trim();
  let q = supabase.from('reply_drafts').select('*').order('created_at', { ascending: false });
  if (status && status !== 'all') q = q.eq('status', status);
  const limit = Math.min(200, Math.max(20, parseInt(searchParams.get('limit') ?? '100', 10) || 100));
  const { data, error } = await q.limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? [], {
    headers: {
      'Cache-Control': 'no-store',
      'X-Reply-Draft-Count': String((data ?? []).length),
    },
  });
}
