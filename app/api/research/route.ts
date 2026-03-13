import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { runTwitterResearchOnly } from '@/agents/researcher';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** GET: list research items (default: twitter only — reply targets). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source') ?? 'twitter';
  let q = supabase.from('research_items').select('*').order('created_at', { ascending: false });
  if (source && source !== 'all') q = q.eq('source_type', source);
  const { data, error } = await q.limit(150);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST: refresh Twitter hits (same as daily Twitter research step). */
export async function POST() {
  try {
    const result = await runTwitterResearchOnly();
    if (result.blocked === 'no_x_keys') {
      return NextResponse.json(
        {
          ...result,
          error:
            'X API keys missing. Add X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET to .env and restart the server.',
        },
        { status: 400 }
      );
    }
    if (result.blocked === 'no_queries') {
      return NextResponse.json(
        {
          ...result,
          error:
            'RESEARCH_TWITTER_QUERIES is empty. Add comma-separated search strings to .env and restart the server.',
        },
        { status: 400 }
      );
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error('Twitter research refresh failed', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
