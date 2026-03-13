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
    <div className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-100 sm:text-3xl">
          Follow suggestions
        </h1>
        <p className="text-base text-stone-400 sm:text-lg">
          Review suggested accounts and mark them followed or dismissed.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <label
          htmlFor="follow-status"
          className="text-base font-medium text-stone-300 sm:shrink-0"
        >
          Status
        </label>
        <select
          id="follow-status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="min-h-[48px] w-full max-w-md rounded-xl border border-stone-600 bg-stone-900 px-4 py-3 text-base text-stone-100 shadow-inner focus:border-amber-600/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30 sm:w-auto sm:min-w-[220px]"
        >
          <option value="recommended">Recommended</option>
          <option value="followed">Followed</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>

      {loading ? (
        <p className="text-lg text-stone-400">Loading…</p>
      ) : follows.length === 0 ? (
        <p className="text-lg text-stone-400">No suggestions for this filter.</p>
      ) : (
        <ul className="flex flex-col gap-4 sm:gap-5">
          {follows.map((f) => (
            <li
              key={f.id}
              className="overflow-hidden rounded-2xl border border-stone-700/90 bg-stone-900/80 shadow-lg shadow-black/20"
            >
              <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="break-words text-xl font-semibold text-amber-500 sm:text-2xl">
                    @{f.handle}
                  </p>
                  {f.display_name && (
                    <p className="text-lg font-medium text-stone-200 sm:text-xl">
                      {f.display_name}
                    </p>
                  )}
                  {f.recommendation_reason && (
                    <p className="max-w-prose text-base leading-relaxed text-stone-300 sm:text-lg sm:leading-relaxed">
                      {f.recommendation_reason}
                    </p>
                  )}
                  <p className="text-sm text-stone-500 sm:text-base">
                    {new Date(f.created_at).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>

                <div className="flex flex-col gap-3 border-t border-stone-700/80 pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:border-t-0 sm:pt-0 lg:flex-col lg:items-stretch lg:border-l lg:border-stone-700/80 lg:pl-8">
                  <span className="inline-flex w-fit rounded-full bg-stone-800 px-3 py-1.5 text-sm font-medium capitalize text-stone-300">
                    {f.status}
                  </span>
                  {f.status === 'recommended' && (
                    <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                      <button
                        type="button"
                        onClick={() => updateStatus(f.id, 'followed')}
                        className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-emerald-700 px-5 text-base font-semibold text-white transition hover:bg-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900 sm:w-auto sm:min-w-[120px] lg:w-full"
                      >
                        Follow
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(f.id, 'dismissed')}
                        className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-stone-600 bg-stone-800/80 px-5 text-base font-medium text-stone-200 transition hover:border-stone-500 hover:bg-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900 sm:w-auto sm:min-w-[120px] lg:w-full"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
