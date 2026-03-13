'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/dashboard';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Login failed');
        return;
      }
      router.push(from.startsWith('/') ? from : '/dashboard');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-950 px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-stone-700 bg-stone-900 p-8 shadow-xl">
        <div>
          <h1 className="font-serif text-2xl text-amber-500">Agent Marshall</h1>
          <p className="mt-2 text-stone-400">Dashboard sign-in</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="pw" className="block text-sm font-medium text-stone-300">
              Password
            </label>
            <input
              id="pw"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full min-h-[48px] rounded-xl border border-stone-600 bg-stone-950 px-4 py-3 text-base text-stone-100 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              autoFocus
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full min-h-[48px] rounded-xl bg-amber-600 text-base font-semibold text-stone-950 hover:bg-amber-500 disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-center text-xs text-stone-600">
          Set <code className="text-stone-500">DASHBOARD_PASSWORD</code> in env. Cron still uses{' '}
          <code className="text-stone-500">CRON_SECRET</code> separately.
        </p>
      </div>
      <Link href="/" className="mt-8 text-sm text-stone-500 hover:text-stone-400">
        ← Home
      </Link>
    </div>
  );
}
