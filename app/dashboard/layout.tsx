import Link from 'next/link';
import { LogoutButton } from './logout-button';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-stone-950">
      <header className="sticky top-0 z-10 border-b border-stone-700/80 bg-stone-950/95 backdrop-blur-sm px-4 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/dashboard"
            className="font-serif text-xl font-medium tracking-tight text-amber-500 hover:text-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950 sm:text-2xl"
          >
            Agent Marshall
          </Link>
          <nav className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Link
              href="/dashboard"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-4 py-2 text-base font-medium text-stone-300 transition hover:bg-stone-800 hover:text-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
            >
              Drafts
            </Link>
            <Link
              href="/dashboard/follows"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-4 py-2 text-base font-medium text-stone-300 transition hover:bg-stone-800 hover:text-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
            >
              Follows
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
