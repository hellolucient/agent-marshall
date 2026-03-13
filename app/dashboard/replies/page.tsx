'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type ResearchTwitter = {
  id: string;
  source_url: string | null;
  title: string;
  summary: string | null;
  raw_content: string | null;
  metadata: Record<string, unknown> & {
    tweetId?: string;
    username?: string;
    twitterQuery?: string;
  };
  created_at: string;
};

type Status = {
  xKeysOk: boolean;
  queriesOk: boolean;
  queryCount: number;
  queriesThisRun?: number;
  ready: boolean;
  hints: string[];
};

export default function RepliesPage() {
  const [items, setItems] = useState<ResearchTwitter[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [loadingFullId, setLoadingFullId] = useState<string | null>(null);
  /** Full text after X fetch (or same as raw_content once loaded) */
  const [fullById, setFullById] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await fetch('/api/research/status');
    const data = await res.json();
    if (data && typeof data.ready === 'boolean') setStatus(data);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    await loadStatus();
    const res = await fetch('/api/research?source=twitter');
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    setItems(list);
    const initial: Record<string, string> = {};
    for (const row of list) {
      const t = (row.raw_content ?? row.summary ?? row.title ?? '').toString();
      if (t) initial[row.id] = t;
    }
    setFullById(initial);
    setLoading(false);
  }, [loadStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshTwitter = async () => {
    setRefreshing(true);
    setMsg(null);
    try {
      const res = await fetch('/api/research', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || JSON.stringify(data) });
        await loadStatus();
        return;
      }
      const parts: string[] = [];
      parts.push(
        `Saved ${data.saved ?? 0} new row(s); ${data.fetched ?? 0} tweet(s) from X (${data.queriesUsed ?? '?'} search call(s)).`
      );
      if (data.note) parts.push(data.note);
      if (data.xErrors?.length) {
        parts.push('X API: ' + data.xErrors.slice(0, 3).join(' · '));
      }
      setMsg({ ok: true, text: parts.join('\n\n') });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: String(e) });
    } finally {
      setRefreshing(false);
    }
  };

  const loadFullFromX = async (id: string) => {
    setLoadingFullId(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/research/${id}/full-text`);
      const data = await res.json();
      if (!res.ok) {
        const err =
          (data.error as string) ||
          `HTTP ${res.status} — open DevTools → Network → full-text for body`;
        setMsg({
          ok: false,
          text:
            err +
            (data.fallback
              ? `\n\nUsing stored preview in box (${String(data.fallback).length} chars).`
              : ''),
        });
        if (data.fallback) setFullById((m) => ({ ...m, [id]: String(data.fallback) }));
        return;
      }
      setFullById((m) => ({ ...m, [id]: data.text }));
      setMsg({
        ok: true,
        text: `Full post loaded (${data.chars} chars). 1 X read. You can draft a reply now.`,
      });
      setItems((rows) =>
        rows.map((r) =>
          r.id === id
            ? { ...r, raw_content: data.text, metadata: { ...r.metadata, tweetId: data.tweetId } }
            : r
        )
      );
    } catch (e) {
      setMsg({ ok: false, text: String(e) });
    } finally {
      setLoadingFullId(null);
    }
  };

  const draftReply = async (id: string) => {
    setDraftingId(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/research/${id}/reply-draft`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      const text = await res.text();
      let data: { error?: string; draft_id?: string; preview?: string } = {};
      try {
        data = JSON.parse(text) as typeof data;
      } catch {
        setMsg({ ok: false, text: `Bad response (${res.status}): ${text.slice(0, 200)}` });
        return;
      }
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || `HTTP ${res.status}` });
        return;
      }
      if (!data.draft_id) {
        setMsg({ ok: false, text: 'No draft_id — ' + text.slice(0, 300) });
        return;
      }
      setMsg({
        ok: true,
        text: `Draft saved id=${data.draft_id}\nPreview: ${data.preview ?? '—'}\nOpening Drafts…`,
      });
      await new Promise((r) => setTimeout(r, 400));
      window.location.href = `/dashboard/reply-drafts?highlight=${data.draft_id}`;
    } catch (e) {
      setMsg({ ok: false, text: String(e) });
    } finally {
      setDraftingId(null);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-100 sm:text-3xl">
          Reply targets
        </h1>
        <p className="max-w-prose text-base text-stone-400 sm:text-lg">
          <strong className="text-stone-300">1.</strong> Load full post from X (1 read).{' '}
          <strong className="text-stone-300">2.</strong> Read the box below.{' '}
          <strong className="text-stone-300">3.</strong> Draft reply → Drafts → approve → publish.
        </p>
      </div>

      {status && !status.ready && (
        <div className="rounded-2xl border border-amber-900/50 bg-amber-950/20 p-4 sm:p-5">
          <p className="mb-2 font-semibold text-amber-200">Setup checklist</p>
          <ul className="list-inside list-disc space-y-2 text-stone-300">
            <li>
              X keys:{' '}
              <span className={status.xKeysOk ? 'text-emerald-400' : 'text-red-300'}>
                {status.xKeysOk ? 'ok' : 'missing'}
              </span>
            </li>
            <li>
              Queries:{' '}
              <span className={status.queriesOk ? 'text-emerald-400' : 'text-red-300'}>
                {status.queriesOk ? `${status.queryCount}` : 'empty'}
              </span>
            </li>
          </ul>
          {status.hints.map((h, i) => (
            <p key={i} className="mt-2 text-sm text-stone-400">
              {h}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={refreshTwitter}
          disabled={refreshing || (status != null && !status.ready)}
          className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-amber-600 px-5 text-base font-semibold text-stone-950 hover:bg-amber-500 disabled:opacity-50"
        >
          {refreshing ? 'Searching…' : 'Refresh Twitter hits'}
        </button>
        <Link
          href="/dashboard"
          className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-stone-600 px-5 text-base font-medium text-stone-200 hover:bg-stone-800"
        >
          Drafts
        </Link>
      </div>

      {msg && (
        <pre
          className={`whitespace-pre-wrap rounded-xl border px-4 py-3 font-sans text-sm sm:text-base ${
            msg.ok
              ? 'border-emerald-800 bg-emerald-950/40 text-emerald-100'
              : 'border-red-800 bg-red-950/40 text-red-100'
          }`}
        >
          {msg.text}
        </pre>
      )}

      {loading ? (
        <p className="text-lg text-stone-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-lg text-stone-400">No Twitter rows yet — refresh after setting queries + keys.</p>
      ) : (
        <ul className="flex flex-col gap-6 sm:gap-8">
          {items.map((item) => {
            const isRt = item.metadata?.isRetweet === true;
            const surface = item.metadata?.surfaceAuthor as string | undefined;
            const user = isRt
              ? `${surface ?? '…'} (reposted; reply goes to original author below)`
              : ((item.metadata?.username as string) ?? surface ?? '…');
            const q = item.metadata?.twitterQuery as string | undefined;
            const body = fullById[item.id] ?? '';
            const loaded = item.metadata?.fullTextFetchedAt != null || body.length > 280;
            return (
              <li
                key={item.id}
                className="overflow-hidden rounded-2xl border border-stone-700/90 bg-stone-900/80 p-5 sm:p-6"
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-amber-500/90">
                      @{user}
                      {q && <span className="font-normal text-stone-500"> · {q}</span>}
                    </p>
                    {item.source_url && (
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-sky-400 hover:text-sky-300"
                      >
                        Open on X →
                      </a>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">
                      Full post (read before replying){' '}
                      <span className="font-normal normal-case text-stone-600">
                        · {body.length} characters
                      </span>
                    </label>
                    <textarea
                      readOnly
                      value={body}
                      rows={Math.min(16, Math.max(6, Math.ceil(body.length / 72)))}
                      className="max-h-[28rem] w-full resize-y rounded-xl border border-stone-600 bg-stone-950 px-4 py-3 font-sans text-base leading-relaxed text-stone-100"
                      aria-label="Tweet full text"
                    />
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      disabled={loadingFullId === item.id}
                      onClick={() => loadFullFromX(item.id)}
                      className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-amber-600/60 bg-amber-950/40 px-5 text-base font-semibold text-amber-100 hover:bg-amber-900/50 disabled:opacity-50"
                    >
                      {loadingFullId === item.id
                        ? 'Loading from X…'
                        : loaded
                          ? 'Reload full post from X (1 read)'
                          : 'Load full post from X (1 read)'}
                    </button>
                    <button
                      type="button"
                      disabled={draftingId === item.id || !body.trim()}
                      onClick={() => draftReply(item.id)}
                      title={!body.trim() ? 'Load full post first' : undefined}
                      className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-stone-100 px-5 text-base font-semibold text-stone-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {draftingId === item.id ? 'Drafting…' : 'Draft reply'}
                    </button>
                  </div>
                  {!body.trim() && (
                    <p className="text-sm text-amber-200/80">
                      Search previews can be short. Click <strong>Load full post from X</strong> first.
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
