'use client';

import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
        router.refresh();
      }}
      className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-stone-600 px-4 py-2 text-sm font-medium text-stone-400 transition hover:border-stone-500 hover:bg-stone-800 hover:text-stone-200"
    >
      Sign out
    </button>
  );
}
