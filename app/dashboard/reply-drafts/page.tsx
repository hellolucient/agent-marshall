'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type ReplyDraft = {
  id: string;
  content: string | null;
  reply_to_post_id: string | null;
  reply_to_author: string | null;
  status: string;
  created_at: string;
  metadata?: { target_tweet_url?: string; research_item_id?: string };
};

function ReplyDraftsInner() {
  const searchParams = useSearchParams();
  const highlightRef = useRef<string | null>(null);
  const [drafts, setDrafts] = useState<ReplyDraft[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const fetchDrafts = async () => {
    setDrafts([]);
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    params.set('_t', String(Date.now()));
    const res = await fetch(`${window.location.origin}/api/reply-drafts?${params}`, {
      cache: 'no-store',
    });
    const data = await res.json();
    setDrafts(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    if (searchParams.get('highlight')) highlightRef.current = searchParams.get('highlight');
  }, [searchParams]);

  useEffect(() => {
    fetchDrafts();
  }, [statusFilter]);

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) fetchDrafts();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [statusFilter]);

  useEffect(() => {
    if (!highlightRef.current || loading || drafts.length === 0) return;
    const id = highlightRef.current;
    highlightRef.current = null;
    const el = document.getElementById(`reply-draft-${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.classList.add('ring-2', 'ring-sky-500', 'ring-offset-2', 'ring-offset-stone-950');
    const t = window.setTimeout(
      () => el?.classList.remove('ring-2', 'ring-sky-500', 'ring-offset-2', 'ring-offset-stone-950'),
      4000
    );
    return () => clearTimeout(t);
  }, [loading, drafts]);

  const updateStatus = async (id: string, status: string) => {
    setMsg(null);
    const res = await fetch(`/api/reply-drafts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert((data as { error?: string }).error || 'Update failed');
      return;
    }
    if (status === 'approved') setStatusFilter('approved');
    else if (status === 'rejected') setStatusFilter('rejected');
    await fetchDrafts();
  };

  const saveEdit = async (id: string) => {
    await fetch(`/api/reply-drafts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editContent }),
    });
    setEditingId(null);
    fetchDrafts();
  };

  const publish = async (id: string) => {
    const res = await fetch(`/api/reply-drafts/${id}?action=publish`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      setMsg('Posted as reply on X.');
      fetchDrafts();
    } else alert(data.error || 'Publish failed');
  };

  const publishQuote = async (id: string) => {
    const res = await fetch(`/api/reply-drafts/${id}?action=publish-quote`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      setMsg('Posted as quote tweet on X.');
      fetchDrafts();
    } else alert(data.error || 'Quote publish failed');
  };

  const publishStandalone = async (id: string) => {
    const res = await fetch(`/api/reply-drafts/${id}?action=publish-standalone`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      setMsg('Posted as standalone tweet (your text + link to their post).');
      fetchDrafts();
    } else alert(data.error || 'Publish failed');
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-100 sm:text-3xl">Reply drafts</h1>
        <p className="text-base text-stone-300 sm:text-lg">
          From{' '}
          <Link href="/dashboard/replies" className="text-sky-400 underline hover:text-sky-300">
            Reply targets
          </Link>
          . Approve → <strong className="text-stone-200">reply</strong> →{' '}
          <strong className="text-stone-200">quote</strong> →{' '}
          <strong className="text-stone-200">standalone</strong> (your text + link; use when X blocks reply{' '}
          <em>and</em> quote). Separate from{' '}
          <Link href="/dashboard" className="text-amber-400 underline hover:text-amber-300">
            Post drafts
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-stone-700/90 bg-stone-900/60 p-4">
        <label htmlFor="reply-status" className="text-stone-200">
          Status
        </label>
        <select
          id="reply-status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-stone-600 bg-stone-950 px-4 py-2 text-stone-100"
        >
          <option value="all">All</option>
          <option value="draft">Draft</option>
          <option value="approved">Approved</option>
          <option value="published">Published</option>
          <option value="rejected">Rejected</option>
        </select>
        <button
          type="button"
          onClick={() => fetchDrafts()}
          disabled={loading}
          className="rounded-xl border border-stone-500 bg-stone-800 px-4 py-2 text-stone-100 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {msg && <p className="text-emerald-200">{msg}</p>}

      {loading ? (
        <p className="text-stone-400">Loading…</p>
      ) : drafts.length === 0 ? (
        <p className="text-stone-400">No reply drafts. Use Reply targets → Draft reply.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {drafts.map((d) => (
            <li
              key={d.id}
              id={`reply-draft-${d.id}`}
              className="overflow-hidden rounded-2xl border border-sky-900/50 bg-stone-900 shadow-lg"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-600 bg-stone-800 px-4 py-3">
                <span className="rounded-lg bg-sky-500/20 px-2 py-1 text-sm font-semibold text-sky-200 ring-1 ring-sky-500/30">
                  Reply draft
                </span>
                <span className="text-sm text-stone-300">
                  {new Date(d.created_at).toLocaleString()}
                </span>
                <span className="rounded-full bg-stone-700 px-2 py-1 text-sm capitalize text-stone-100">
                  {d.status}
                </span>
              </div>
              <div className="space-y-3 p-4">
                <p className="text-sm text-amber-200/90">
                  Reply to{' '}
                  <span className="text-amber-400">@{d.reply_to_author ?? 'user'}</span>
                  {d.metadata?.target_tweet_url && (
                    <>
                      {' '}
                      <a
                        href={d.metadata.target_tweet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-400 underline"
                      >
                        (target)
                      </a>
                    </>
                  )}
                </p>
                {editingId === d.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[100px] w-full rounded-lg border border-stone-600 bg-stone-950 p-3 text-stone-100"
                      rows={4}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(d.id)}
                        className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-stone-950"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-stone-500 px-4 py-2 text-stone-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap text-stone-100">{d.content ?? '—'}</p>
                    <div className="flex flex-wrap gap-2 border-t border-stone-700 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(d.id);
                          setEditContent(d.content ?? '');
                        }}
                        className="rounded-lg border border-amber-600/50 px-4 py-2 text-amber-200"
                      >
                        Edit
                      </button>
                      {d.status === 'draft' && (
                        <>
                          <button
                            type="button"
                            onClick={() => updateStatus(d.id, 'approved')}
                            className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus(d.id, 'rejected')}
                            className="rounded-lg border border-red-500/60 px-4 py-2 text-red-200"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {d.status === 'approved' && (
                        <>
                          <button
                            type="button"
                            onClick={() => publish(d.id)}
                            className="rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white"
                          >
                            Publish reply
                          </button>
                          <button
                            type="button"
                            onClick={() => publishQuote(d.id)}
                            className="rounded-lg border border-violet-500/70 bg-violet-950/60 px-4 py-2 font-semibold text-violet-100 hover:bg-violet-900/50"
                            title="Quote tweet — blocked on some posts"
                          >
                            Publish as quote
                          </button>
                          <button
                            type="button"
                            onClick={() => publishStandalone(d.id)}
                            className="rounded-lg border border-emerald-600/70 bg-emerald-950/50 px-4 py-2 font-semibold text-emerald-100 hover:bg-emerald-900/40"
                            title="Normal tweet: your draft + link. Works when reply & quote are blocked."
                          >
                            Publish standalone
                          </button>
                        </>
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

export default function ReplyDraftsPage() {
  return (
    <Suspense fallback={<p className="text-stone-400">Loading…</p>}>
      <ReplyDraftsInner />
    </Suspense>
  );
}
