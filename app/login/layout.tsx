import { Suspense } from 'react';

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoginFallback />}>{children}</Suspense>;
}

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-950 text-stone-400">
      Loading…
    </div>
  );
}
