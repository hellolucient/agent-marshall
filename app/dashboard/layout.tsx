import Link from 'next/link';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-stone-700/60 px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="font-serif text-amber-800/90 text-lg">
          Agent Marshall
        </Link>
        <nav className="flex gap-4 text-sm text-stone-400">
          <Link href="/dashboard" className="hover:text-stone-200">Drafts</Link>
          <Link href="/dashboard/follows" className="hover:text-stone-200">Follows</Link>
        </nav>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
