import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-serif text-amber-800/90 mb-2">Agent Marshall</h1>
      <p className="text-stone-500 text-sm mb-8">Editorial intelligence for Marshall S Martineau</p>
      <Link
        href="/dashboard"
        className="rounded border border-stone-600 px-4 py-2 text-stone-300 hover:bg-stone-800 hover:border-amber-900/50 transition"
      >
        Open dashboard
      </Link>
    </main>
  );
}
