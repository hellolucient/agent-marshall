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
  const [statusFilter, setStatusFilter] = useState<string>('draft');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const fetchDrafts = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (tab !== 'all') params.set('type', tab);
    if (statusFilter) params.set('status', statusFilter);
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

  const typeLabel = (t: string) => ({ tweet: 'Tweet', thread: 'Thread', reply: 'Reply', substack_outline: 'Substack' }[t] ?? t);

  return (
    <div>
      <h1 className="text-xl font-semibold text-stone-200 mb-4">Drafts</h1>
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'tweet', 'thread', 'reply', 'substack_outline'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded text-sm ${tab === t ? 'bg-amber-900/40 text-amber-200 border border-amber-800/50' : 'bg-stone-800 text-stone-400 border border-stone-600'}`}
          >
            {t === 'all' ? 'All' : typeLabel(t)}
          </button>
        ))}
        <span className="text-stone-500 text-sm self-center ml-2">Status:</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-stone-800 border border-stone-600 rounded px-2 py-1 text-sm text-stone-200"
        >
          <option value="draft">Draft</option>
          <option value="approved">Approved</option>
          <option value="published">Published</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      {loading ? (
        <p className="text-stone-500">Loading…</p>
      ) : drafts.length === 0 ? (
        <p className="text-stone-500">No drafts.</p>
      ) : (
        <ul className="space-y-4">
          {drafts.map((d) => (
            <li key={d.id} className="border border-stone-700 rounded-lg p-4 bg-stone-900/50">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs text-amber-800/80">{typeLabel(d.draft_type)}</span>
                <span className="text-xs text-stone-500">{new Date(d.created_at).toLocaleString()}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-stone-700 text-stone-400">{d.status}</span>
              </div>
              {d.reply_to_author && (
                <p className="text-xs text-stone-500 mb-1">Reply to @{d.reply_to_author}</p>
              )}
              {editingId === d.id ? (
                <div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-stone-800 border border-stone-600 rounded p-2 text-sm text-stone-200 min-h-[80px]"
                    rows={3}
                  />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => saveEdit(d.id)} className="px-3 py-1 bg-amber-900/50 rounded text-sm">Save</button>
                    <button onClick={() => setEditingId(null)} className="px-3 py-1 bg-stone-700 rounded text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-stone-200 text-sm whitespace-pre-wrap">{d.content ?? '—'}</p>
                  {d.draft_type === 'substack_outline' && d.metadata && (
                    <div className="mt-2 text-sm text-stone-400 space-y-1">
                      {d.metadata.outline && <p><span className="text-stone-500">Outline:</span> {d.metadata.outline}</p>}
                      {d.metadata.body_notes && <p><span className="text-stone-500">Notes:</span> {d.metadata.body_notes}</p>}
                    </div>
                  )}
                  {d.thread_tweets?.length ? (
                    <div className="mt-2 pl-2 border-l border-stone-600 space-y-1">
                      {d.thread_tweets.map((t, i) => (
                        <p key={i} className="text-stone-400 text-sm">{t}</p>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <button onClick={() => { setEditingId(d.id); setEditContent(d.content ?? ''); }} className="text-xs text-amber-600 hover:text-amber-500">Edit</button>
                    {d.status === 'draft' && (
                      <button onClick={() => updateStatus(d.id, 'approved')} className="text-xs text-green-600 hover:text-green-500">Approve</button>
                    )}
                    {d.status === 'draft' && (
                      <button onClick={() => updateStatus(d.id, 'rejected')} className="text-xs text-red-500 hover:text-red-400">Reject</button>
                    )}
                    {d.status === 'approved' && d.draft_type !== 'substack_outline' && (
                      <button onClick={() => publish(d.id)} className="text-xs text-amber-500 hover:text-amber-400">Publish</button>
                    )}
                    {d.draft_type === 'substack_outline' && (
                      <span className="text-xs text-stone-500">Substack: publish manually</span>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
