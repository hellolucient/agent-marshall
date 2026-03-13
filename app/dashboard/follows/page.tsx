'use client';

import { useEffect, useState } from 'react';

type Follow = {
  id: string;
  handle: string;
  display_name: string | null;
  recommendation_reason: string | null;
  status: string;
  created_at: string;
};

export default function FollowsPage() {
  const [follows, setFollows] = useState<Follow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('recommended');
  const [loading, setLoading] = useState(true);

  const fetchFollows = async () => {
    setLoading(true);
    const params = statusFilter ? `?status=${statusFilter}` : '';
    const res = await fetch(`/api/follows${params}`);
    const data = await res.json();
    setFollows(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchFollows();
  }, [statusFilter]);

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/follows/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchFollows();
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-stone-200 mb-4">Follow suggestions</h1>
      <div className="mb-4">
        <span className="text-stone-500 text-sm mr-2">Status:</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-stone-800 border border-stone-600 rounded px-2 py-1 text-sm text-stone-200"
        >
          <option value="recommended">Recommended</option>
          <option value="followed">Followed</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>
      {loading ? (
        <p className="text-stone-500">Loading…</p>
      ) : follows.length === 0 ? (
        <p className="text-stone-500">No suggestions.</p>
      ) : (
        <ul className="space-y-3">
          {follows.map((f) => (
            <li key={f.id} className="border border-stone-700 rounded-lg p-4 bg-stone-900/50 flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-stone-200">@{f.handle}</p>
                {f.display_name && <p className="text-sm text-stone-500">{f.display_name}</p>}
                {f.recommendation_reason && <p className="text-sm text-stone-400 mt-1">{f.recommendation_reason}</p>}
                <p className="text-xs text-stone-500 mt-1">{new Date(f.created_at).toLocaleString()}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <span className="text-xs px-2 py-0.5 rounded bg-stone-700 text-stone-400">{f.status}</span>
                {f.status === 'recommended' && (
                  <>
                    <button onClick={() => updateStatus(f.id, 'followed')} className="text-xs text-green-600 hover:text-green-500">Follow</button>
                    <button onClick={() => updateStatus(f.id, 'dismissed')} className="text-xs text-stone-500 hover:text-stone-400">Dismiss</button>
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
