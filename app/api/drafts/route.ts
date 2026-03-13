import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type')?.trim(); // tweet | thread | reply | substack_outline
  const status = searchParams.get('status')?.trim(); // draft | approved | published | rejected | all
  let q = supabase.from('draft_posts').select('*').order('created_at', { ascending: false });
  if (type) q = q.eq('draft_type', type);
  if (status && status !== 'all') q = q.eq('status', status);
  const { data, error } = await q.limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
