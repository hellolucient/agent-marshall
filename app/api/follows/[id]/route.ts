import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function normHandle(h: string) {
  return h.trim().toLowerCase().replace(/^@/, '');
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { status } = body;
  if (!status || !['recommended', 'followed', 'dismissed'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const { data: target, error: fetchErr } = await supabase
    .from('followed_accounts')
    .select('id, platform, handle')
    .eq('id', id)
    .single();
  if (fetchErr || !target) {
    return NextResponse.json({ error: fetchErr?.message ?? 'Not found' }, { status: 404 });
  }

  const key = normHandle(target.handle);
  const { data: samePlatform } = await supabase
    .from('followed_accounts')
    .select('id, handle')
    .eq('platform', target.platform);
  const ids = (samePlatform ?? [])
    .filter((r) => normHandle(r.handle) === key)
    .map((r) => r.id);
  if (ids.length === 0) ids.push(id);

  const updates: Record<string, unknown> = { status };
  if (status === 'followed') updates.followed_at = new Date().toISOString();
  if (status === 'dismissed') updates.followed_at = null;

  const { data: updated, error } = await supabase
    .from('followed_accounts')
    .update(updates)
    .in('id', ids)
    .select()
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const row = updated?.[0];
  if (!row) {
    const { data: again } = await supabase.from('followed_accounts').select('*').eq('id', id).single();
    return NextResponse.json(again);
  }
  return NextResponse.json(row);
}
