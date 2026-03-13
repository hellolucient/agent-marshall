'use client';

import { useEffect, useState } from 'react';

type Draft = {
  id: string;
  draft_type: string;
  content: string | null;
  thread_tweets: string[] | null;
  reply_to_author: string | null;
  status: string;
  created_at: string;
  metadata?: { outline?: string; body_notes?: string };
};

type Tab = 'tweet' | 'thread' | 'reply' | 'substack_outline';

export default function DashboardPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [tab, setTab] = useState<Tab | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [heartbeatBusy, setHeartbeatBusy] = useState(false);
  const [heartbeatMsg, setHeartbeatMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchDrafts = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (tab !== 'all') params.set('type', tab);
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    const res = await fetch(`/api/drafts?${params}`);
    const data = await res.json();
    setDrafts(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDrafts();
  }, [tab, statusFilter]);

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/drafts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchDrafts();
  };

  const saveEdit = async (id: string) => {
    await fetch(`/api/drafts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editContent }),
    });
    setEditingId(null);
    fetchDrafts();
  };

  const publish = async (id: string) => {
    const res = await fetch(`/api/drafts/${id}?action=publish`, { method: 'POST' });
    const data = await res.json();
    if (data.success) fetchDrafts();
    else alert(data.error || 'Publish failed');
  };

  const typeLabel = (t: string) =>
    ({ tweet: 'Tweet', thread: 'Thread', reply: 'Reply', substack_outline: 'Substack' }[t] ?? t);

  const tabBtn = (active: boolean) =>
    active
      ? 'border-amber-500 bg-amber-950/50 text-amber-100 ring-1 ring-amber-500/40'
      : 'border-stone-600 bg-stone-800 text-stone-200 hover:border-stone-500 hover:bg-stone-700';

  const runHeartbeat = async (mode: 'daily' | 'weekly') => {
    setHeartbeatBusy(true);
    setHeartbeatMsg(null);
    try {
      const res = await fetch('/api/heartbeat/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : res.statusText || 'Request failed');
      }
      const summary =
        mode === 'daily' && data.result
          ? `Daily done — research ${data.result.research ?? '—'}, ideas ${data.result.ideas ?? '—'}, swarm ${data.result.swarm ?? '—'}, tweets ${data.result.tweets ?? '—'}, follow recs ${data.result.networker ?? '—'}`
          : mode === 'weekly' && data.result
            ? `Weekly done — thread ${data.result.thread ? 'yes' : '—'}, Substack ${data.result.substack ? 'yes' : '—'}`
            : `${mode} heartbeat finished.`;
      setHeartbeatMsg({ ok: true, text: summary });
      await fetchDrafts();
    } catch (e) {
      setHeartbeatMsg({ ok: false, text: String(e) });
    } finally {
      setHeartbeatBusy(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <section
        className="rounded-2xl border border-red-900/40 bg-gradient-to-b from-red-950/25 to-stone-900/80 p-4 sm:p-6"
        aria-labelledby="heartbeat-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h2 id="heartbeat-heading" className="text-lg font-semibold text-amber-100 sm:text-xl">
            Heartbeat <span className="font-normal text-stone-500">(run manually)</span>
          </h2>
          {heartbeatBusy && (
            <div
              className="flex items-center gap-3 rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-2"
              aria-live="polite"
            >
              <span
                className="relative flex h-3 w-3 shrink-0 rounded-full bg-red-500 animate-heartbeat-dot"
                title="Heartbeat running"
              />
              <div
                className="h-5 w-5 shrink-0 rounded-full border-2 border-red-500/25 border-t-red-400 animate-spin"
                aria-hidden
              />
              <span className="text-sm font-medium text-red-100/95">
                Heartbeat running—keep this tab open
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 space-y-4 text-base leading-relaxed text-stone-300">
          <p>
            <strong className="text-stone-100">Why two buttons?</strong> They match the two cron schedules.
          </p>
          <ul className="list-inside list-disc space-y-2 pl-1 text-stone-300 sm:list-outside sm:pl-5">
            <li>
              <strong className="text-amber-200/90">Daily</strong> — Your regular pipeline: pull RSS, generate
              ideas, run the swarm on them, write <em>tweet</em> drafts, suggest people to follow. Use this most
              days (same as daily CRON).
            </li>
            <li>
              <strong className="text-amber-200/90">Weekly</strong> — Slower, longer-form pass: one{' '}
              <em>thread</em> draft, a <em>Substack</em> outline, plus a short reflection note. Lighter load;
              run once a week (same as weekly CRON).
            </li>
          </ul>
          <p className="text-sm text-stone-500">
            Daily can take <strong className="text-stone-400">several minutes</strong> (swarm). CLI:{' '}
            <code className="rounded bg-stone-950 px-1.5 py-0.5 text-stone-400">
              npm run cron:heartbeat daily
            </code>{' '}
            / <code className="rounded bg-stone-950 px-1.5 py-0.5 text-stone-400">weekly</code>
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={heartbeatBusy}
            onClick={() => runHeartbeat('daily')}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 text-base font-semibold text-stone-950 hover:bg-amber-500 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 sm:min-w-[180px]"
          >
            {heartbeatBusy ? (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-heartbeat-dot" />
                Running daily…
              </>
            ) : (
              'Run daily heartbeat'
            )}
          </button>
          <button
            type="button"
            disabled={heartbeatBusy}
            onClick={() => runHeartbeat('weekly')}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-amber-700/60 bg-stone-900 px-5 text-base font-semibold text-amber-200 hover:bg-stone-800 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 sm:min-w-[200px]"
          >
            {heartbeatBusy ? (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-heartbeat-dot" />
                Running weekly…
              </>
            ) : (
              'Run weekly heartbeat'
            )}
          </button>
        </div>

        {heartbeatMsg && (
          <p
            className={`mt-4 rounded-xl px-4 py-3 text-base ${heartbeatMsg.ok ? 'bg-emerald-950/50 text-emerald-100' : 'bg-red-950/50 text-red-200'}`}
            role="status"
          >
            {heartbeatMsg.text}
          </p>
        )}
      </section>

      <div className="space-y-2 border-t border-stone-800 pt-6 sm:pt-8">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-100 sm:text-3xl">Drafts</h1>
        <p className="text-base text-stone-300 sm:text-lg">
          Filter by type and status, then edit, approve, or publish.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-stone-700/90 bg-stone-900/60 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {(['all', 'tweet', 'thread', 'reply', 'substack_outline'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`min-h-[48px] rounded-xl border px-4 py-2.5 text-base font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 ${tabBtn(tab === t)}`}
            >
              {t === 'all' ? 'All' : typeLabel(t)}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <label htmlFor="draft-status" className="text-base font-medium text-stone-200 sm:shrink-0">
            Status
          </label>
          <select
            id="draft-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-[48px] w-full max-w-md rounded-xl border border-stone-600 bg-stone-950 px-4 py-3 text-base text-stone-100 focus:border-amber-600/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30 sm:w-auto sm:min-w-[220px]"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="published">Published</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-lg text-stone-300">Loading…</p>
      ) : drafts.length === 0 ? (
        <p className="text-lg text-stone-300">No drafts match these filters.</p>
      ) : (
        <ul className="flex flex-col gap-4 sm:gap-5">
          {drafts.map((d) => (
            <li
              key={d.id}
              className="overflow-hidden rounded-2xl border border-stone-600 bg-stone-900 shadow-lg shadow-black/25"
            >
              {/* High-contrast meta strip: reads clearly vs card body */}
              <div className="flex flex-col gap-3 border-b border-stone-600 bg-stone-800 px-5 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="inline-flex rounded-lg bg-amber-500/20 px-3 py-1.5 text-sm font-semibold uppercase tracking-wide text-amber-300 ring-1 ring-amber-500/30">
                    {typeLabel(d.draft_type)}
                  </span>
                  <span className="text-sm font-medium text-stone-200 sm:text-base">
                    {new Date(d.created_at).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
                <span className="inline-flex w-fit rounded-full bg-stone-700 px-3 py-1.5 text-sm font-semibold capitalize text-stone-100 ring-1 ring-stone-500/50">
                  {d.status}
                </span>
              </div>

              <div className="space-y-4 p-5 sm:p-6">
                {d.reply_to_author && (
                  <p className="text-base font-medium text-amber-200/90">
                    Reply to <span className="text-amber-400">@{d.reply_to_author}</span>
                  </p>
                )}

                {editingId === d.id ? (
                  <div className="space-y-3">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[140px] w-full rounded-xl border border-stone-500 bg-stone-950 px-4 py-3 text-base leading-relaxed text-stone-100 placeholder:text-stone-500 focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/25"
                      rows={5}
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => saveEdit(d.id)}
                        className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-amber-600 px-5 text-base font-semibold text-stone-950 hover:bg-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-stone-500 bg-stone-800 px-5 text-base font-medium text-stone-100 hover:bg-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap text-base leading-relaxed text-stone-100 sm:text-lg">
                      {d.content ?? '—'}
                    </p>

                    {d.draft_type === 'substack_outline' && d.metadata && (
                      <div className="space-y-3 rounded-xl border border-stone-600 bg-stone-800/80 p-4 text-base">
                        {d.metadata.outline && (
                          <p className="leading-relaxed text-stone-100">
                            <span className="font-semibold text-amber-200">Outline </span>
                            {d.metadata.outline}
                          </p>
                        )}
                        {d.metadata.body_notes && (
                          <p className="leading-relaxed text-stone-100">
                            <span className="font-semibold text-amber-200">Notes </span>
                            {d.metadata.body_notes}
                          </p>
                        )}
                      </div>
                    )}

                    {d.thread_tweets?.length ? (
                      <div className="space-y-3 border-l-4 border-amber-600/70 pl-4">
                        {d.thread_tweets.map((t, i) => (
                          <p
                            key={i}
                            className="text-base leading-relaxed text-stone-200 sm:text-[1.05rem]"
                          >
                            <span className="mr-2 font-semibold text-amber-400/90">{i + 1}.</span>
                            {t}
                          </p>
                        ))}
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-2 border-t border-stone-700 pt-4 sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(d.id);
                          setEditContent(d.content ?? '');
                        }}
                        className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-amber-600/50 bg-amber-950/40 px-5 text-base font-semibold text-amber-200 hover:bg-amber-900/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 sm:min-w-[100px]"
                      >
                        Edit
                      </button>
                      {d.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => updateStatus(d.id, 'approved')}
                          className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-emerald-700 px-5 text-base font-semibold text-white hover:bg-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:min-w-[120px]"
                        >
                          Approve
                        </button>
                      )}
                      {d.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => updateStatus(d.id, 'rejected')}
                          className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-red-500/60 bg-red-950/50 px-5 text-base font-semibold text-red-200 hover:bg-red-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 sm:min-w-[100px]"
                        >
                          Reject
                        </button>
                      )}
                      {d.status === 'approved' && d.draft_type !== 'substack_outline' && (
                        <button
                          type="button"
                          onClick={() => publish(d.id)}
                          className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-amber-600 px-5 text-base font-semibold text-stone-950 hover:bg-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 sm:min-w-[120px]"
                        >
                          Publish
                        </button>
                      )}
                      {d.draft_type === 'substack_outline' && (
                        <span className="inline-flex min-h-[48px] items-center text-base text-stone-300">
                          Substack: publish manually
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
